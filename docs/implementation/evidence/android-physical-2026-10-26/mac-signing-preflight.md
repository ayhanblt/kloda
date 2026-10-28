# Mac signing preflight — 2026-10-26

Later checkpoint: [free Personal Team native/Electron-host validation](../../macos-personal-team-validation-2026-10-26.md). The zero-identity/profile observations below describe the earlier pre-certificate state and are preserved as historical evidence.

Scope: user-requested verification of the Mac hardware key and receiver path with
free Personal Team signing. This is a prerequisites check, not runtime acceptance.

| Check | Observed result |
| --- | --- |
| Xcode | 27.1, build 27A9275; query exit 0 |
| Usable Apple Development / Mac Developer code-signing identities | 0; query exit 0, confirmed with normal host access |
| Provisioning profiles in the two standard Xcode profile directories | 0 |
| Existing repository Electron host Team ID | Absent |
| Existing repository Electron host entitlement keys | Empty |
| Existing repository Electron embedded provisioning profile | Absent |
| Secure Enclave key create / sign / reopen | NOT_RUN |
| Native receiver startup / transfer | NOT_RUN |

`security find-identity -v -p codesigning` was captured privately and reduced to
counts; no certificate subjects, account names or identity hashes are published.
The count describes identities usable by this session, not every possible keychain
or an assertion that no Apple account exists. The standard profile directory check
does not search arbitrary locations.

Separate result review: both identity queries returned zero development identities;
Xcode was available. Existing Electron metadata lacks the prerequisites. No runtime
success or paid-membership requirement is inferred from this result. No new native
owner or key was opened, and no account/certificate/profile, authority, archive or
Git state was changed by these checks.

Next prerequisite: the user authenticates their Apple Account in Xcode and makes a
Personal Team development signing identity available. Then prepare an isolated
development bundle and an Apple-authorized profile/entitlements, preserving ADR0015
development/production isolation. Validate the actual signed host before attempting
disposable key creation, signature/reopen and native receiver tests. Free-account
compatibility remains unverified until those tests succeed; no ad-hoc access group,
legacy Keychain or software-key fallback is permitted.
