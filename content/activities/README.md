# Activities

Each activity is one `.yml` file in this folder. The file name becomes its web
address, so `riverside-walk-march.yml` appears at `/activities/riverside-walk-march/`.

There are no activities yet, so the website shows an honest "nothing on yet"
page that invites people to register interest or suggest an idea. **Never add an
activity that is not really happening.**

Copy `_template.yml.example`, rename it, fill it in and set `status: published`.

## Fields

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Short and plain: "Sunday morning riverside walk" |
| `summary` | yes | One or two sentences shown on the listing |
| `description` | yes | What happens, in plain English. Markdown allowed. |
| `category` | yes | One of the categories in `content/categories.yml` |
| `status` | yes | `draft`, `published`, `cancelled` or `full` |
| `starts` | yes | Date and time, e.g. `2026-11-14T10:00` (UK time) |
| `ends` | no | Date and time it finishes |
| `repeats` | no | Plain words, e.g. "Every second Sunday" |
| `area` | yes | Neighbourhood or town, e.g. "Hackney" |
| `venue.name` | yes | Or "Meeting point" for walks |
| `venue.address` | no | Full address, or where exactly to meet |
| `venue.directions` | no | Transport, parking, how to find the group |
| `cost.type` | yes | `free`, `pay-what-you-can`, `subsidised` or `paid` |
| `cost.details` | no | e.g. "£3, free for anyone who needs it - no questions asked" |
| `capacity` | no | Only fill in if places are actually counted |
| `places_left` | no | Only fill in if kept up to date |
| `accessibility` | yes | List what you know. Say "Not yet checked" rather than guess. |
| `access_tags` | no | Used by the access filter. Only add tags you've checked: `step-free`, `accessible-toilet`, `seating`, `quiet`, `hearing-loop`, `bsl` |
| `age` | no | e.g. "Adults 18+" |
| `what_to_bring` | no | |
| `how_to_join` | yes | `just-turn-up`, `register-interest` or `external-booking` |
| `booking_url` | no | Needed if `how_to_join` is `external-booking` |
| `organiser` | yes | Name of the person or partner running it |
| `contact_email` | no | Defaults to the main Seek My Tribe address |
| `cancellation` | no | How you will tell people if it is called off |
| `guidance` | no | Any safety or participation notes |
