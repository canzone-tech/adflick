# BATCH 10 API examples

Base URL: `http://localhost:4000/api/v1`. All examples except device/player routes require a valid user JWT. Use the current organization context from the authenticated session.

## List incidents
`GET /incidents?status=OPEN`

## Summary
`GET /incidents/summary`

## Create a manual incident
`POST /incidents`
```json
{
  "title": "Screen offline: Main lobby",
  "description": "No heartbeat received; operator to verify power and network.",
  "screenId": "SCREEN_ID_IN_CURRENT_ORGANIZATION",
  "category": "SCREEN_OFFLINE",
  "severity": "HIGH"
}
```

## Run an alert scan
`POST /incidents/scan-alerts`

The endpoint scans up to 500 screens in the current organization and returns counts and IDs of newly created incidents.

## Acknowledge
`PATCH /incidents/INCIDENT_ID`
```json
{ "status": "ACKNOWLEDGED", "assignedToId": "ACTIVE_USER_ID" }
```

## Start investigation
`PATCH /incidents/INCIDENT_ID`
```json
{ "status": "IN_PROGRESS" }
```

## Resolve
`PATCH /incidents/INCIDENT_ID`
```json
{ "status": "RESOLVED", "resolutionNote": "Network restored; player heartbeat stable." }
```

Never expose tokens, device secrets, signed media URLs or other credentials in incident descriptions.
