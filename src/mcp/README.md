# Paws WhatsApp MCP Server

Model Context Protocol (MCP) server for pet management in the Paws WhatsApp application.

## Setup

Start the MCP server:

```bash
node src/mcp/server.ts
```

## Available Tools

### `register_user`
Register or update a user by phone number.

**Parameters:**
- `name` (string): User's full name
- `phone` (string): User's phone number

### `list_pets`
Get all pets owned by a user.

**Parameters:**
- `phone` (string): Owner's phone number

### `register_pet`
Register a new pet for an existing user.

**Parameters:**
- `name` (string): Pet's name
- `dateOfBirth` (string): ISO date format (YYYY-MM-DDTHH:mm:ss.sssZ)
- `species` (string): Either "CAT" or "DOG"
- `ownerPhone` (string): Owner's phone number

## Response Format

All tools return JSON responses with:
- `success` (boolean): Operation status
- `data` (object): Result data if successful
- `error` (string): Error message if failed