"""Field catalog registry.

A Service Node exposes its output fields so the Decision Builder can offer
them as selectable targets when authoring rule conditions. This module
provides a simple in-memory registry plus a helper that derives a catalog
from a sample service output object.

Example service output::

    {
        "addressMatch": true,
        "matchScore": 87,
        "status": "VERIFIED",
        "country": "IN"
    }

Derived catalog::

    [
        {"name": "addressMatch", "type": "boolean", "path": ""},
        {"name": "matchScore",   "type": "number",  "path": ""},
        {"name": "status",       "type": "string",  "path": ""},
        {"name": "country",       "type": "string",  "path": ""}
    ]
"""

from __future__ import annotations

import threading
from typing import Any, Dict, List, Optional

from .models import FieldCatalog, FieldCatalogEntry


_PYTHON_TYPE_TO_JSON: Dict[str, str] = {
    "str": "string",
    "int": "number",
    "float": "number",
    "bool": "boolean",
    "list": "array",
    "dict": "object",
    "NoneType": "null",
}


def _json_type(value: Any) -> str:
    """Map a Python value to a JSON type label."""
    if value is None:
        return "null"
    return _PYTHON_TYPE_TO_JSON.get(type(value).__name__, "string")


def derive_field_catalog(
    output: Dict[str, Any],
    path_prefix: str = "",
) -> List[FieldCatalogEntry]:
    """Derive a flat list of field catalog entries from a sample output.

    Nested objects are flattened using dot-paths so that a field like
    ``address.matchScore`` is discoverable. Lists are described as arrays
    without descending into their elements.
    """
    entries: List[FieldCatalogEntry] = []
    if not isinstance(output, dict):
        return entries

    for key, value in output.items():
        full_path = f"{path_prefix}.{key}" if path_prefix else key
        jtype = _json_type(value)

        if isinstance(value, dict):
            entries.append(
                FieldCatalogEntry(
                    name=key,
                    type="object",
                    path=path_prefix,
                    description=f"Nested object at {full_path}",
                )
            )
            entries.extend(derive_field_catalog(value, path_prefix=full_path))
        elif isinstance(value, list):
            entries.append(
                FieldCatalogEntry(
                    name=key,
                    type="array",
                    path=path_prefix,
                    description=f"Array at {full_path}",
                )
            )
        else:
            entries.append(
                FieldCatalogEntry(
                    name=key,
                    type=jtype,
                    path=path_prefix,
                )
            )

    return entries


class FieldCatalogRegistry:
    """Thread-safe in-memory registry of service node field catalogs."""

    def __init__(self) -> None:
        self._catalogs: Dict[str, FieldCatalog] = {}
        self._lock = threading.RLock()

    def register(self, catalog: FieldCatalog) -> FieldCatalog:
        with self._lock:
            self._catalogs[catalog.nodeId] = catalog
            return catalog

    def register_from_output(
        self,
        node_id: str,
        output: Dict[str, Any],
        service_name: str = "",
    ) -> FieldCatalog:
        entries = derive_field_catalog(output)
        catalog = FieldCatalog(nodeId=node_id, serviceName=service_name, fields=entries)
        return self.register(catalog)

    def get(self, node_id: str) -> Optional[FieldCatalog]:
        with self._lock:
            return self._catalogs.get(node_id)

    def list_all(self) -> List[FieldCatalog]:
        with self._lock:
            return list(self._catalogs.values())

    def remove(self, node_id: str) -> bool:
        with self._lock:
            return self._catalogs.pop(node_id, None) is not None
