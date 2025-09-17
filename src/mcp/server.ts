#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from "express";
import { PetRepository } from './repository';
import {
  RegisterUserSchema,
  ListPetsSchema,
  RegisterPetSchema,
  AskUserSchema,
  RegisterUserInput,
  ListPetsInput,
  RegisterPetInput,
  AskUserInput,
} from './types';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';

const repository = new PetRepository();

const server = new Server(
  {
    name: 'paws-wpp-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'register_user',
        description: 'Register a new user or update existing user with phone and name',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'User full name',
            },
            phone: {
              type: 'string',
              description: 'User phone number',
            },
          },
          required: ['name', 'phone'],
        },
      },
      {
        name: 'list_pets',
        description: 'List all pets owned by a user identified by phone number',
        inputSchema: {
          type: 'object',
          properties: {
            phone: {
              type: 'string',
              description: 'Owner phone number',
            },
          },
          required: ['phone'],
        },
      },
      {
        name: 'register_pet',
        description: 'Register a new pet for an existing user',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Pet name',
            },
            dateOfBirth: {
              type: 'string',
              description: 'Pet date of birth in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)',
            },
            species: {
              type: 'string',
              enum: ['CAT', 'DOG'],
              description: 'Pet species',
            },
            ownerPhone: {
              type: 'string',
              description: 'Owner phone number',
            },
          },
          required: ['name', 'dateOfBirth', 'species', 'ownerPhone'],
        },
      },
      {
        name: 'ask_user',
        description: 'Ask the user for clarification or missing information',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Clarification message to send to the user',
            },
          },
          required: ['message'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'register_user': {
        const validatedArgs = RegisterUserSchema.parse(args) as RegisterUserInput;
        const result = await repository.upsertUserByPhone(validatedArgs.name, validatedArgs.phone);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'list_pets': {
        const validatedArgs = ListPetsSchema.parse(args) as ListPetsInput;
        const result = await repository.listPetsByUserPhone(validatedArgs.phone);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'register_pet': {
        const validatedArgs = RegisterPetSchema.parse(args) as RegisterPetInput;
        const result = await repository.createPetForUser(
          validatedArgs.name,
          new Date(validatedArgs.dateOfBirth),
          validatedArgs.species,
          validatedArgs.ownerPhone
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ask_user': {
        const validatedArgs = AskUserSchema.parse(args) as AskUserInput;
        const result = {
          success: true,
          data: { message: validatedArgs.message },
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: `Tool execution failed: ${errorMessage}`,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const mode = (process.env.MCP_TRANSPORT || 'stdio').toLowerCase();
  if (mode === 'stdio') {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Paws WhatsApp MCP Server running on stdio');
    return;
  }

  if (mode === 'http') {
    const app = express();
    app.use(express.json());

    // CORS (exponer Mcp-Session-Id si vas a consumir desde un browser)
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
      res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });

    // Endpoint MCP (Streamable HTTP)
    app.all('/mcp', async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableDnsRebindingProtection: true,
        // If you need SSE legacy compatibility, many examples expose it in parallel;
        // Streamable HTTP is the current recommended approach. :contentReference[oaicite:1]{index=1}
      });

      await server.connect(transport);
      await transport.handleRequest(req, res);
    });

    const port = Number(process.env.MCP_PORT || 3000);
    app.listen(port, () => {
      console.error(`Streamable HTTP listening on http://0.0.0.0:${port}/mcp`);
    });
    return;
  }

  throw new Error(`Unknown MCP_TRANSPORT: ${mode}`);
}

runServer().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});