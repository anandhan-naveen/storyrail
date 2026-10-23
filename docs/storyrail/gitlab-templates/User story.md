<!-- Copy this file to .gitlab/issue_templates/ in the backlog project. StoryRail starts from an issue made with it. -->

## Story

As a … I want … so that …

## Acceptance criteria

- AC1: …
- AC2: …

## Applications

One line per application this story changes, starting with its name; say which other application it calls.
StoryRail finds each one in GitLab by this name.

- INSU-ta01 (task API): what changes, e.g. new endpoint GET /tasks/{id}/info, reads from the DB
- INSU-fa01 (facade API): what changes, calls INSU-ta01
- INSU-sp01 (frontend): what changes, calls INSU-fa01

## Functional documents

Attach them here (drag the files into this description) before running StoryRail:

- Screen document: …
- API document: …

## Design (Figma)

Link to the frame(s), if the story changes a screen.

## Notes

Constraints, performance or accessibility needs, anything out of scope.

/label ~"user story"
