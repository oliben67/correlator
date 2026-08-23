# Meta-tag — {{key}} for {{artefact-id}}

**Stored as:** `tag-{{key}}-{{artefact-id}}`
**Target artifact:** `{{artefact-id}}`
**Key:** `comment` | `version` | `link-to`
**Value type:** `string` | `number` | `artefact ID`
**Value:** `{{value}}`

## Contents

Use this document to record one metadata entry for an existing artifact.

- `comment`: a free-form string comment about the target artifact.
- `version`: a numeric version value for the target artifact.
- `link-to`: another artifact ID that the current artifact should point to.

## Notes

- Meta-tags are lightweight annotations; they do not define rules or work
  items on their own.
- Keep the storage name aligned with the target artifact ID and the key,
  following the pattern `tag-<key>-<artefact-id>`.
