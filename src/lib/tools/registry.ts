/* eslint-disable @typescript-eslint/no-require-imports */
import { ToolHandler } from './types';
import { RegisterUserTool } from './register-user';
import { ListPetsTool } from './list-pets';
import { RegisterPetTool } from './register-pet';
import { AskUserTool } from './ask-user';
import { GetUserInfoTool } from './get-user-info';
import { ListConsultationsTool } from './list-consultations';
import { GetConsultationTool } from './get-consultation';
import { WebSearchTool } from './web-search';
import { MapSearchTool } from './map-search';
import { AddPetProfilePictureTool } from './add-pet-profile-picture';
import { ProcessStoredProfileImageTool } from './process-stored-profile-image';

export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();
  private webSearchTool: WebSearchTool;
  private mapSearchTool: MapSearchTool;

  constructor() {
    // Initialize all tools
    this.tools.set('ask_user', new AskUserTool());
    this.tools.set('register_user', new RegisterUserTool());
    this.tools.set('get_user_info', new GetUserInfoTool());
    this.tools.set('register_pet', new RegisterPetTool());
    this.tools.set('list_pets', new ListPetsTool());
    this.tools.set('list_consultations', new ListConsultationsTool());
    this.tools.set('get_consultation', new GetConsultationTool());
    this.tools.set('add_pet_profile_picture', new AddPetProfilePictureTool());
    this.tools.set('process_stored_profile_image', new ProcessStoredProfileImageTool());

    // Web search tool (conditional)
    this.webSearchTool = new WebSearchTool();
    
    // Map search tool (conditional)
    this.mapSearchTool = new MapSearchTool();
  }

  getTool(name: string): ToolHandler | undefined {
    // Handle web search conditionally
    if (name === 'web_search') {
      return this.webSearchTool;
    }
    
    // Handle map search conditionally
    if (name === 'map_search') {
      return this.mapSearchTool;
    }
    
    return this.tools.get(name);
  }

  getAllTools(includeWebSearch = true, includeMapSearch = true): ToolHandler[] {
    const tools = Array.from(this.tools.values());

    if (includeWebSearch) {
      tools.push(this.webSearchTool);
    }

    if (includeMapSearch) {
      tools.push(this.mapSearchTool);
    }

    return tools;
  }

  getToolDefinitions(includeWebSearch = true, includeMapSearch = true) {
    return this.getAllTools(includeWebSearch, includeMapSearch).map(tool => tool.definition);
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

  hasMapSearch(): boolean {
    // Check if map search is enabled by checking for Google Places API key
    return !!process.env.GOOGLE_PLACES_API_KEY;
  }
}