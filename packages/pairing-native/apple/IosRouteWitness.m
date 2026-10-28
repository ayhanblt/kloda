#import <Foundation/Foundation.h>
#import <Network/Network.h>
#include <stdint.h>
#include <string.h>

@interface KlodaRouteObservation : NSObject
@property(nonatomic, strong) nw_path_t path;
@property(nonatomic) BOOL invalid;
@property(nonatomic) nw_interface_type_t type;
@property(nonatomic, strong) dispatch_semaphore_t ready;
@end

@implementation KlodaRouteObservation
- (instancetype)initWithType:(nw_interface_type_t)type {
    if ((self = [super init])) { _type = type; _ready = dispatch_semaphore_create(0); }
    return self;
}
- (void)observe:(nw_path_t)path {
    @synchronized(self) {
        BOOL first = self.path == nil;
        if (!first && !nw_path_is_equal(self.path, path)) self.invalid = YES;
        if (first) self.path = path;
        if (first) dispatch_semaphore_signal(self.ready);
    }
}
- (BOOL)valid {
    @synchronized(self) { return self.path != nil && !self.invalid; }
}
- (int)interfaceClass:(const char *)name index:(uint32_t)index {
    @synchronized(self) {
        if (!self.path || self.invalid) return 0;
        __block int result = 0;
        nw_path_enumerate_interfaces(self.path, ^bool(nw_interface_t interface) {
            nw_interface_type_t type = nw_interface_get_type(interface);
            if (type == self.type &&
                nw_interface_get_index(interface) == index &&
                strcmp(nw_interface_get_name(interface), name) == 0) {
                result = type == nw_interface_type_wifi ? 1 : 2;
                return false;
            }
            return true;
        });
        return result;
    }
}
@end

@interface KlodaRouteWitness : NSObject
@property(nonatomic, strong) nw_path_monitor_t wifiMonitor;
@property(nonatomic, strong) nw_path_monitor_t wiredMonitor;
@property(nonatomic, strong) KlodaRouteObservation *wifi;
@property(nonatomic, strong) KlodaRouteObservation *wired;
@property(nonatomic, strong) KlodaRouteObservation *selected;
@end

@implementation KlodaRouteWitness
- (void)dealloc {
    if (_wifiMonitor) nw_path_monitor_cancel(_wifiMonitor);
    if (_wiredMonitor) nw_path_monitor_cancel(_wiredMonitor);
}
- (int)interfaceClass:(const char *)name index:(uint32_t)index {
    @synchronized(self) {
        if (self.selected) return [self.selected interfaceClass:name index:index];
        int wifi = [self.wifi interfaceClass:name index:index];
        int wired = [self.wired interfaceClass:name index:index];
        return wifi && wired ? 0 : wifi + wired;
    }
}
- (BOOL)selectName:(const char *)name index:(uint32_t)index {
    @synchronized(self) {
        if (self.selected) return NO;
        int wifi = [self.wifi interfaceClass:name index:index];
        int wired = [self.wired interfaceClass:name index:index];
        if ((wifi != 0) == (wired != 0)) return NO;
        self.selected = wifi ? self.wifi : self.wired;
        return [self.selected valid];
    }
}
- (BOOL)valid {
    @synchronized(self) { return self.selected && [self.selected valid]; }
}
@end

static void startMonitor(nw_path_monitor_t monitor, KlodaRouteObservation *observation) {
    // Pending callbacks own only the observation, never a raw witness pointer.
    nw_path_monitor_set_update_handler(monitor, ^(nw_path_t path) { [observation observe:path]; });
    dispatch_queue_t queue = dispatch_queue_create("com.kloda.ios.route", DISPATCH_QUEUE_SERIAL);
    nw_path_monitor_set_queue(monitor, queue);
    nw_path_monitor_start(monitor);
}

void *kloda_ios_route_open(void) {
    @autoreleasepool {
        KlodaRouteWitness *witness = [KlodaRouteWitness new];
        witness.wifiMonitor = nw_path_monitor_create_with_type(nw_interface_type_wifi);
        witness.wiredMonitor = nw_path_monitor_create_with_type(nw_interface_type_wired);
        if (!witness.wifiMonitor || !witness.wiredMonitor) return NULL;
        witness.wifi = [[KlodaRouteObservation alloc] initWithType:nw_interface_type_wifi];
        witness.wired = [[KlodaRouteObservation alloc] initWithType:nw_interface_type_wired];
        startMonitor(witness.wifiMonitor, witness.wifi);
        startMonitor(witness.wiredMonitor, witness.wired);
        // Initial snapshots enumerate interfaces; internet reachability is not admission evidence.
        dispatch_time_t deadline = dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC);
        if (dispatch_semaphore_wait(witness.wifi.ready, deadline) != 0 ||
            dispatch_semaphore_wait(witness.wired.ready, deadline) != 0) return NULL;
        return (__bridge_retained void *)witness;
    }
}

int kloda_ios_route_valid(void *raw) {
    @autoreleasepool {
        if (!raw) return 0;
        KlodaRouteWitness *witness = (__bridge KlodaRouteWitness *)raw;
        return [witness valid] ? 1 : 0;
    }
}

int kloda_ios_route_interface_class(void *raw, const char *name, uint32_t index) {
    @autoreleasepool {
        if (!raw || !name || strnlen(name, 16) == 16 || index == 0) return 0;
        KlodaRouteWitness *witness = (__bridge KlodaRouteWitness *)raw;
        return [witness interfaceClass:name index:index];
    }
}

int kloda_ios_route_select(void *raw, const char *name, uint32_t index) {
    @autoreleasepool {
        if (!raw || !name || strnlen(name, 16) == 16 || index == 0) return 0;
        KlodaRouteWitness *witness = (__bridge KlodaRouteWitness *)raw;
        return [witness selectName:name index:index] ? 1 : 0;
    }
}

void kloda_ios_route_close(void *raw) {
    if (raw) { @autoreleasepool { (void)CFBridgingRelease(raw); } }
}
