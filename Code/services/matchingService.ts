import { supabase } from "@/lib/supabase";

interface RunMatchCandidate {
  userId: number;
  ideaId: number;
  displayName: string | null;
  bio: string | null;
  targetPace: number | null;
  targetDistance: number | null;
  location: string | null;
  similarity: number;
}

export class MatchingService {
  // Length expected by the DB vector column (gte-small uses 384 dims)
  private static readonly VECTOR_SIZE = 384;

  /**
   * Generate a very simple, deterministic vector embedding for the given text.
   * The algorithm maps character codes into the vector positions and then normalises.
   * It is NOT semantically meaningful but keeps the same dimensionality so that
   * existing DB functions depending on vector length keep working.
   */
  private static generateEmbedding(text: string): number[] {
    // Empty or whitespace-only text → zero vector.
    if (!text || text.trim() === "") {
      return new Array(MatchingService.VECTOR_SIZE).fill(0);
    }

    const vector = new Array<number>(MatchingService.VECTOR_SIZE).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = i % MatchingService.VECTOR_SIZE;
      vector[index] += charCode;
    }

    // Normalise to the range [0,1] to roughly mimic cosine-normalised vectors.
    const maxVal = Math.max(...vector, 1);
    return vector.map((v) => v / maxVal);
  }

  static async updateUserEmbedding(userId: number): Promise<void> {
    console.log(`Updating (dummy) embedding for user ${userId}`);

    const { data: userData, error: userError } = await supabase
      .from("user")
      .select("id, bio")
      .eq("id", userId)
      .single();

    if (userError) throw new Error(userError.message);
    if (!userData) throw new Error(`User ${userId} not found`);

    // Fetch most recent idea to enrich the text (optional)
    const { data: ideaData } = await supabase
      .from("run")
      .select("location, target_meters, target_seconds_per_km")
      .eq("user", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let combinedText = `Bio: ${userData.bio || "(empty)"}. `;

    if (ideaData) {
      const idea = ideaData;
      const km = idea.target_meters ? idea.target_meters / 1000 : null;
      const pace = idea.target_seconds_per_km;
      combinedText += `Idea => loc: ${idea.location ?? "?"}, dist: ${km ?? "?"}km, pace: ${pace ?? "?"}`;
    }

    const embedding = MatchingService.generateEmbedding(combinedText);

    const { error: updateErr } = await supabase
      .from("user")
      .update({ embedding: embedding as any })
      .eq("id", userId);

    if (updateErr) throw updateErr;
  }

  static async getRunMatches(
    currentUserId: number,
    currentIdeaId: number
  ): Promise<RunMatchCandidate[]> {
    const { data, error } = await supabase.rpc("get_run_matches_by_embedding", {
      p_current_user_id: currentUserId,
      p_current_idea_id: currentIdeaId,
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      userId: row.user_id,
      ideaId: row.idea_id,
      displayName: row.display_name,
      bio: row.bio,
      targetPace: row.target_pace,
      targetDistance: row.target_distance,
      location: row.location,
      similarity: row.vector_similarity,
    }));
  }
}
