# Shot Notes API Extension

This document describes the new shot notes functionality added to the ShotHistoryPlugin.

## Enhanced Shot History API

The existing shot history API endpoints have been enhanced to automatically include notes data when available.

### Get Shot History List
**Request Type:** `req:history:list`

**Response:**
```json
{
  "tp": "res:history:list",
  "rid": "unique-request-id",
  "history": [
    {
      "id": "000001",
      "history": "1,Profile Name,1692123456\n0,85.0,84.5,9.0,8.7,2.1,2.0,1.8,0.0,0.0,0.0\n...",
      "notes": {
        "id": "000001",
        "rating": 4,
        "doseIn": 18.5,
        "doseOut": 37.2,
        "ratio": 2.01,
        "grindSetting": "2.5",
        "balanceTaste": "balanced",
        "notes": "Great shot with nice crema and balanced flavor",
        "timestamp": 1692123456
      }
    }
  ]
}
```

### Get Single Shot History
**Request Type:** `req:history:get`

**Response:**
```json
{
  "tp": "res:history:get",
  "rid": "unique-request-id",
  "history": "1,Profile Name,1692123456\n0,85.0,84.5,9.0,8.7,2.1,2.0,1.8,0.0,0.0,0.0\n...",
  "notes": {
    "id": "000001",
    "rating": 4,
    "doseIn": 18.5,
    "doseOut": 37.2,
    "ratio": 2.01,
    "grindSetting": "2.5",
    "balanceTaste": "balanced",
    "notes": "Great shot with nice crema and balanced flavor",
    "timestamp": 1692123456
  }
}
```

## New Shot Notes API Endpoints

### Get Shot Notes
**Request Type:** `req:history:notes:get`

**Request:**
```json
{
  "tp": "req:history:notes:get",
  "id": "000001",
  "rid": "unique-request-id"
}
```

**Response:**
```json
{
  "tp": "res:history:notes:get",
  "rid": "unique-request-id",
  "notes": {
    "id": "000001",
    "rating": 4,
    "doseIn": 18.5,
    "doseOut": 37.2,
    "ratio": 2.01,
    "grindSetting": "2.5",
    "balanceTaste": "balanced",
    "notes": "Great shot with nice crema and balanced flavor",
    "timestamp": 1692123456
  }
}
```

### Save Shot Notes
**Request Type:** `req:history:notes:save`

**Request:**
```json
{
  "tp": "req:history:notes:save",
  "id": "000001",
  "rid": "unique-request-id",
  "notes": {
    "id": "000001",
    "rating": 4,
    "doseIn": 18.5,
    "doseOut": 37.2,
    "ratio": 2.01,
    "grindSetting": "2.5",
    "balanceTaste": "balanced",
    "notes": "Great shot with nice crema and balanced flavor"
  }
}
```

**Response:**
```json
{
  "tp": "res:history:notes:save",
  "rid": "unique-request-id",
  "msg": "Ok"
}
```

## File Structure

For each shot ID (e.g., "000001"), two files are created:
- `/h/000001.dat` - Contains shot history data (existing)
- `/h/000001.json` - Contains shot notes data (new)

## Frontend Implementation

The new `ShotNotesCard` component provides:
- Star rating system (1-5 stars)
- Dose in/out fields with automatic ratio calculation
- Grind setting input
- Balance/taste selector (bitter, balanced, sour)
- Free-form notes text area
- Edit/save functionality

The dose out field is automatically pre-populated with the final volume measurement from the shot data.

### Enhanced Export Functionality

The shot history export has been enhanced to automatically include notes data:
- Export filename: `{shot-id}-complete.json`
- Contains both shot history data and notes data in a single JSON file
- Notes are automatically included if they exist for the shot
- Maintains backward compatibility - shots without notes export normally

### Export Data Structure

```json
{
  "id": "000001",
  "version": "1",
  "profile": "Profile Name",
  "timestamp": 1692123456,
  "duration": 30000,
  "volume": 37.2,
  "samples": [...],
  "notes": {
    "id": "000001",
    "rating": 4,
    "doseIn": 18.5,
    "doseOut": 37.2,
    "ratio": 2.01,
    "grindSetting": "2.5",
    "balanceTaste": "balanced",
    "notes": "Great shot with nice crema and balanced flavor",
    "timestamp": 1692123456
  }
}
```

## Schema

The shot notes follow the schema defined in `/schema/shot_notes.json`:
- `id`: Shot ID (required)
- `rating`: Star rating 0-5
- `doseIn`: Input dose in grams
- `doseOut`: Output dose in grams
- `ratio`: Calculated ratio (doseOut/doseIn)
- `grindSetting`: String description of grind setting
- `balanceTaste`: One of "bitter", "balanced", "sour"
- `notes`: Free-form text notes
- `timestamp`: When notes were last updated
