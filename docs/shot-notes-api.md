# Shot Notes API Extension

This document describes the new shot notes functionality added to the ShotHistoryPlugin.

## Enhanced Shot Recording

The shot history recording has been enhanced for volumetric shots:

### Extended Recording for Scale-Connected Shots

When brewing with a connected Bluetooth scale (regardless of volumetric or time-based mode), the system now continues recording for a brief period after the shot officially ends to capture the additional liquid that drips from the portafilter.

**Extended Recording Logic:**
- **Trigger**: Automatically activates when Bluetooth scale data is available and weight > 0
- **Mode Independent**: Works for both volumetric and time-based shots
- **Duration**: Maximum 3 seconds additional recording
- **Weight Stabilization**: Stops early if weight doesn't change by more than 0.1g for 1 second
- **Purpose**: Captures more accurate final extraction weight

**Configuration Constants:**
```cpp
constexpr unsigned long EXTENDED_RECORDING_DURATION = 3000; // 3 seconds max
constexpr unsigned long WEIGHT_STABILIZATION_TIME = 1000;  // 1 second stability
constexpr float WEIGHT_STABILIZATION_THRESHOLD = 0.1f;     // 0.1g threshold
```

This ensures that the recorded shot data includes the complete extraction weight, not just the weight at the moment the shot timer stops.

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
