#include <Network/Network.h>
#include <assert.h>
#include <stdio.h>

/* SDK parameter round-trip only: no endpoint, connection, listener or monitor. */
int main(void) {
    nw_parameters_t parameters = nw_parameters_create_secure_tcp(
        NW_PARAMETERS_DISABLE_PROTOCOL, NW_PARAMETERS_DEFAULT_CONFIGURATION);
    assert(parameters != NULL);
    nw_parameters_set_required_interface_type(parameters, nw_interface_type_wifi);
    assert(nw_parameters_get_required_interface_type(parameters) == nw_interface_type_wifi);
    nw_parameters_set_include_peer_to_peer(parameters, false);
    assert(!nw_parameters_get_include_peer_to_peer(parameters));
    nw_parameters_set_multipath_service(parameters, nw_multipath_service_disabled);
    assert(nw_parameters_get_multipath_service(parameters) == nw_multipath_service_disabled);
    puts("PASS simulator Network parameters: interface type and disabled peer-to-peer/multipath round-trip");

    nw_parameters_set_local_only(parameters, true);
    assert(nw_parameters_get_local_only(parameters));
    nw_parameters_set_prefer_no_proxy(parameters, true);
    assert(nw_parameters_get_prefer_no_proxy(parameters));
    nw_release(parameters);
    puts("PASS simulator Network parameters: listener-local and proxy-preference flags round-trip");
    puts("PARAMETER_CHECKS_ONLY_NOT_DIRECT_ROUTE_OR_PROXY_EXCLUSION_PROOF");
    return 0;
}
