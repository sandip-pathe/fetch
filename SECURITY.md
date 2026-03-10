# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately by emailing the repository maintainer (see the GitHub profile for contact).

Please include:
- A clear description of the vulnerability
- Steps to reproduce
- Potential impact

You can expect a response within 48 hours.

## Scope

**In scope**
- Authentication bypass (accessing another user's clips)
- XSS via stored clip content
- Firestore security rule weaknesses
- Data leakage across user boundaries

**Out of scope**
- Denial of service via excessive Firestore writes (Firebase enforces its own limits)
- Brute-force login (Firebase Auth handles this)
- Issues requiring physical access to the device

## Firestore Security Rules

The minimum recommended Firestore rules are in the README. Users deploying their own instance are responsible for applying them correctly.
