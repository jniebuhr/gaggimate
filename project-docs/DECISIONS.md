# Architectural Decisions

## Remove Unsafe Routes

Removed:

- /ota
- /scales
- /pidtune

Reason:

Unsafe machine functionality outside project scope.

## Keep Original Responsive Sidebar

Reason:

Original shell already solved responsive navigation.

Attempts to force permanent sidebar created layout instability.

## Replace Dashboard

Reason:

Original dashboard exposed unsafe machine controls.

Replaced with safe informational landing page.
