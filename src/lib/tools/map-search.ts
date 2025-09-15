import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';

// Input schema for map search (with defaults)
const MapSearchArgs = z.object({
  query: z.string().min(1, 'Search query is required'),
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  maxResults: z.number().min(1).max(20, 'Max results must be between 1 and 20').default(10),
  types: z.array(z.enum(['veterinary_care', 'pet_store', 'animal_hospital', 'pet_grooming'])).default(['veterinary_care', 'pet_store'])
});

// Required input type for the tool handler
type MapSearchInputType = {
  query: string;
  latitude: number;
  longitude: number;
  maxResults: number;
  types: ('veterinary_care' | 'pet_store' | 'animal_hospital' | 'pet_grooming')[];
};

// Google Places API response types
interface GooglePlace {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryType?: string;
  types?: string[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  googleMapsLinks?: {
    googleMapsUri: string;
  };
}

interface GooglePlacesResponse {
  places: GooglePlace[];
}

export class MapSearchTool implements ToolHandler<MapSearchInputType> {
  name = 'map_search';
  schema = MapSearchArgs as z.ZodType<MapSearchInputType>;

  definition = {
    name: 'map_search',
    description: 'Search for nearby pet-related businesses (veterinarians, pet stores, animal hospitals, pet grooming) by location using Google Places API. Results are automatically ranked by distance from the specified location. Use this ONLY when users ask about finding physical locations or businesses near a specific address or coordinates. This is the ONLY tool for location-based searches.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
          description: 'Search query for the type of pet service location (e.g., "veterinarian", "pet store", "animal hospital") - results will be ranked by distance'
        },
        latitude: {
          type: 'number' as const,
          minimum: -90,
          maximum: 90,
          description: 'Latitude coordinate for the search center'
        },
        longitude: {
          type: 'number' as const,
          minimum: -180,
          maximum: 180,
          description: 'Longitude coordinate for the search center'
        },
        maxResults: {
          type: 'number' as const,
          minimum: 1,
          maximum: 20,
          default: 10,
          description: 'Maximum number of results to return (1-20)'
        },
        types: {
          type: 'array' as const,
          items: {
            type: 'string' as const,
            enum: ['veterinary_care', 'pet_store', 'animal_hospital', 'pet_grooming']
          },
          default: ['veterinary_care', 'pet_store'],
          description: 'Types of pet-related businesses to search for'
        }
      },
      required: ['query', 'latitude', 'longitude'],
      additionalProperties: false
    }
  };

  config = {
    timeout: 15000, // 15 seconds for external API
    retries: 2,
    retryDelay: 1000
  };

  private getApiKey(): string | null {
    return process.env.GOOGLE_PLACES_API_KEY || null;
  }

  private isEnabled(): boolean {
    return !!this.getApiKey();
  }

  async execute(input: MapSearchInputType, context: ToolContext): Promise<ToolResult> {
    if (!this.isEnabled()) {
      return {
        ok: false,
        error: 'Google Places API is not configured. Please set GOOGLE_PLACES_API_KEY environment variable.'
      };
    }

    try {
      // Parse input with defaults applied
      const parsedInput = MapSearchArgs.parse(input);
      
      console.log(`[${context.requestId}] Map search: "${parsedInput.query}" near (${parsedInput.latitude}, ${parsedInput.longitude})`);

      const apiKey = this.getApiKey()!;
      const response = await this.searchNearbyPlaces(parsedInput, apiKey);

      if (!response.ok) {
        return {
          ok: false,
          error: `Google Places API error: ${response.error}`
        };
      }

      const places = response.data?.places || [];
      const formattedResults = this.formatPlaces(places, parsedInput.query);

      return {
        ok: true,
        data: {
          query: parsedInput.query,
          location: {
            latitude: parsedInput.latitude,
            longitude: parsedInput.longitude
          },
          results: formattedResults,
          count: formattedResults.length
        }
      };

    } catch (error) {
      console.error(`[${context.requestId}] Map search failed:`, error);

      return {
        ok: false,
        error: `Map search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async searchNearbyPlaces(input: z.infer<typeof MapSearchArgs>, apiKey: string): Promise<{ ok: boolean; data?: GooglePlacesResponse; error?: string }> {
    const url = 'https://places.googleapis.com/v1/places:searchNearby';
    
    const requestBody = {
      includedTypes: input.types,
      maxResultCount: input.maxResults,
      rankby: 'DISTANCE',
      locationRestriction: {
        circle: {
          center: {
            latitude: input.latitude,
            longitude: input.longitude
          }
        }
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.businessStatus,places.primaryType,places.types,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri'
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const data: GooglePlacesResponse = await response.json();
      return {
        ok: true,
        data
      };

    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private formatPlaces(places: GooglePlace[], query: string): Array<{
    id: string;
    name: string;
    address: string;
    location: { latitude: number; longitude: number };
    rating?: number;
    ratingCount?: number;
    phone?: string;
    website?: string;
    mapsUrl?: string;
    businessStatus?: string;
    types: string[];
    distance?: number;
  }> {
    return places.map(place => ({
      id: place.id,
      name: place.displayName.text,
      address: place.formattedAddress,
      location: {
        latitude: place.location.latitude,
        longitude: place.location.longitude
      },
      rating: place.rating,
      ratingCount: place.userRatingCount,
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
      website: place.websiteUri,
      mapsUrl: place.googleMapsUri || place.googleMapsLinks?.googleMapsUri,
      businessStatus: place.businessStatus,
      types: place.types || [place.primaryType || 'unknown']
    }));
  }
}
