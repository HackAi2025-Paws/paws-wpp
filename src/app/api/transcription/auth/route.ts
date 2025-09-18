import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

export async function POST() {
  try {
    // Validate environment variables
    if (!process.env.DEEPGRAM_API_KEY) {
      console.error("[AuthAPI] Missing DEEPGRAM_API_KEY environment variable");
      console.error(
        "[AuthAPI] Please create a .env.local file with your Deepgram API key"
      );
      console.error(
        "[AuthAPI] Visit https://console.deepgram.com/ to get your API key"
      );
      return NextResponse.json(
        {
          error:
            "DEEPGRAM_API_KEY not configured. Please check your environment variables.",
          details:
            "Visit https://console.deepgram.com/ to get your API key and add it to .env.local",
        },
        { status: 500 }
      );
    }

    // Create Deepgram client with API key
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    // Grant temporary access token (30-second TTL)
    const { result, error } = await deepgram.auth.grantToken();

    console.log("[AuthAPI] api/transcription/auth result: ", result);

    if (error || !result) {
      console.error("[AuthAPI] Failed to grant access token:", error);
      return NextResponse.json(
        { error: "Failed to create temporary access token" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      accessToken: result.access_token,
      expiresIn: result.expires_in,
    });
  } catch (error) {
    console.error("[AuthAPI] Error creating temporary access token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
