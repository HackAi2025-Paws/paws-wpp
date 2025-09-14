import { ToolHandler } from './types';
import { RegisterUserTool } from './register-user';
import { ListPetsTool } from './list-pets';
import { RegisterPetTool } from './register-pet';
import { AskUserTool } from './ask-user';
import { WebSearchTool } from './web-search';

export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();
  private webSearchTool: WebSearchTool;

  constructor() {
    // Initialize all tools
    this.tools.set('register_user', new RegisterUserTool());
    this.tools.set('list_pets', new ListPetsTool());
    this.tools.set('register_pet', new RegisterPetTool());
    this.tools.set('ask_user', new AskUserTool());

    // Web search tool (conditional)
    this.webSearchTool = new WebSearchTool();
  }

  getTool(name: string): ToolHandler | undefined {
    // Handle web search conditionally
    if (name === 'web_search') {
      return this.webSearchTool;
    }
    return this.tools.get(name);
  }

  getAllTools(includeWebSearch = true): ToolHandler[] {
    const tools = Array.from(this.tools.values());

    if (includeWebSearch) {
      tools.push(this.webSearchTool);
    }

    return tools;
  }

  getToolDefinitions(includeWebSearch = true) {
    return this.getAllTools(includeWebSearch).map(tool => tool.definition);
  }

  hasWebSearch(): boolean {
    // Check if web search is enabled by trying to create the service
    try {
      const { createSearchConfig } = require('../web-search/config');
      const config = createSearchConfig();
      return !!config.tavilyApiKey;
    } catch {
      return false;
    }
  }
}