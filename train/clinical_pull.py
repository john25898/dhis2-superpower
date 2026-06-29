"""Legacy entrypoint for DHIS extraction.

This script now delegates to backend.dhis_export so credentials come from
environment variables instead of hardcoded values.
"""

from backend.dhis_export import main


if __name__ == "__main__":
    main()