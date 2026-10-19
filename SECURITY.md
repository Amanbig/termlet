# Security Policy

Termlet handles SSH credentials, private keys, and remote files, so we take security reports seriously.

## Supported versions

Only the latest release receives security fixes. Please update before reporting.

| Version | Supported |
| :--- | :---: |
| Latest release | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub:
[**Report a vulnerability**](https://github.com/Amanbig/termlet/security/advisories/new)

Please include:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept
- Affected version and operating system

You can expect an acknowledgement within a few days. We will keep you updated while we investigate, and credit you in the release notes if you'd like.

## Scope

In scope: credential or key leakage, host key verification bypass, unsafe handling of remote file paths, and flaws in the auto-update mechanism.

Out of scope: vulnerabilities in the SSH servers you connect to, or issues that require an attacker to already have local access to your user account.
