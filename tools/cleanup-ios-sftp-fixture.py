#!/usr/bin/env python3
"""Remove exactly one verified owned Windows SFTP fixture Keychain profile."""
from pathlib import Path
import argparse
import json
import plistlib
import re
import subprocess

parser=argparse.ArgumentParser(); parser.add_argument('root',type=Path); args=parser.parse_args()
root=args.root.resolve(); owner=json.loads((root/'ownership.json').read_text()); bundle=owner['bundle']; sim=owner['simulator']
assert root.name.startswith('kloda-windows-sftp16b-') and sim=='497AAA0F-967E-4781-9468-3F05CA2D3D5A'
assert re.fullmatch(r'com\.kloda\.fixture\.sftp16\.windows(?:photos)?\.r[0-9a-f]{32}',bundle)
assert (owner['address'],owner['port'],owner['remoteRoot'])==('192.168.1.54',2222,'/upload')
assert owner['fingerprint']=='SHA256:JO6gTt4ojeX0s5ivDmtoHrvZ+0DLuXAeKcW2+ZNTmzQ'
assert plistlib.loads((root/'Fixture.entitlements').read_bytes())=={'keychain-access-groups':[bundle]}
container=Path((root/'container-path.txt').read_text()); required=['seed','reopen'] if owner['kind']=='files' else ['seed','reopen','cleanup']
for mode in required:
    value=json.loads((container/f'Documents/{mode}-result.json').read_text())
    assert value.get('mode')==mode and value.get('status')=='PASS'
    if owner['kind']=='files': assert value.get('phase')=='finished'
    elif mode=='cleanup': assert value.get('deletedOwnedAssets')==2 and value.get('deletedOwnedAlbums')==2
source=root/'cleanup.m'
source.write_text('''#import <Foundation/Foundation.h>
#import <Security/Security.h>
int main(void) { @autoreleasepool {
 NSDictionary *q = @{(__bridge id)kSecClass:(__bridge id)kSecClassGenericPassword, (__bridge id)kSecAttrService:@"BUNDLE.sftp.native.v1", (__bridge id)kSecAttrAccount:@"profile", (__bridge id)kSecAttrAccessGroup:@"BUNDLE", (__bridge id)kSecAttrSynchronizable:@NO};
 NSMutableDictionary *read=[q mutableCopy]; read[(__bridge id)kSecReturnData]=@YES; CFTypeRef item=NULL;
 if(SecItemCopyMatching((__bridge CFDictionaryRef)read,&item)!=errSecSuccess || !item) return 2;
 NSData *bytes=CFBridgingRelease(item); NSDictionary *profile=[NSJSONSerialization JSONObjectWithData:bytes options:0 error:NULL]; NSDictionary *target=profile[@"target"];
 if(![profile[@"version"] isEqual:@1] || ![target[@"address"] isEqual:@"192.168.1.54"] || ![target[@"port"] isEqual:@2222] || ![target[@"root"] isEqual:@"/upload"] || ![target[@"username"] isEqual:@"kloda16b"] || ![target[@"fingerprint"] isEqual:@"SHA256:JO6gTt4ojeX0s5ivDmtoHrvZ+0DLuXAeKcW2+ZNTmzQ"]) return 3;
 if(SecItemDelete((__bridge CFDictionaryRef)q)!=errSecSuccess) return 4;
 if(SecItemCopyMatching((__bridge CFDictionaryRef)read,NULL)!=errSecItemNotFound) return 5;
 puts("PASS exact owned SFTP fixture profile removed; post-delete lookup=errSecItemNotFound"); return 0;
} }
'''.replace('BUNDLE',bundle))
sdk=subprocess.check_output(['xcrun','--sdk','iphonesimulator','--show-sdk-path'],text=True).strip(); binary=root/'cleanup'
command=['xcrun','--sdk','iphonesimulator','clang','-target','arm64-apple-ios16.4-simulator','-isysroot',sdk,'-fobjc-arc','-fblocks','-Wall','-Wextra','-Werror',str(source),'-framework','Foundation','-framework','Security','-o',str(binary)]
for section,path in [('__entitlements',root/'Fixture.entitlements'),('__ents_der',root/'Fixture.der')]:
    command+=['-Xlinker','-sectcreate','-Xlinker','__TEXT','-Xlinker',section,'-Xlinker',str(path)]
subprocess.run(command,check=True,capture_output=True)
subprocess.run(['codesign','--force','--sign','-',str(binary)],check=True,capture_output=True)
subprocess.run(['xcrun','simctl','terminate',sim,bundle],check=True,capture_output=True)
result=subprocess.run(['xcrun','simctl','spawn',sim,str(binary)],check=True,capture_output=True,text=True,timeout=20)
(root/'cleanup.log').write_text(result.stdout+result.stderr); print(result.stdout,flush=True)
assert not (container/'Library/Caches/fixture-password').exists()
(root/'keychain-cleanup.json').write_text(json.dumps({'testProfileKeychainDeleted':True,'appTerminated':True,'privateAppPasswordInputRemoved':True,'otherKeychainServicesTouched':False,'simulatorShutdown':False},indent=2)+'\n')
