# Optimizing Runner Matchmaking App

_Exported on 26/05/2025 at 22:06:20 BST from Cursor (0.50.7)_

---

**User**

so, we're building this run dating app that matches people who want to go for a similar run

every person has their bio where they talk about their run experience, their vibes, etc.

at any point in time, people have an ideal upcoming run details including

- the target pace, in minutes per km
- the target distance, in km
- the ideal location

currently, we store in the supabase database the bio as text, the target pace as seconds, the target distance as meters, and the ideal location as text

when looking for matches, we want to show users all other users' upcoming ideal run details sorted by most similar first

similarity should be calculated as the distance between the target distance and pace, as well as the physical distance of the ideal location, as well as some AI embedding distance similarity of the vectors of the bio

how to go about implementing this efficiently?

how to store stuff in the database so that the sorting is efficient?

how to represent location so that it's easy to sort by distance?

what else should we be thinking about?

how do we make sure the sorting is actually close to what the humans are actually looking for (for exmaple, probably location is more important than pace: if we have similar pace and distance target but I'm in Milan and you're in Rome, it's not going to happen that we run together - at the same time, if we're both in rome but I want to run 20km and you want to run 5km, we're not running together)

---

**Cursor**

Let me look at your current database structure first to understand what we're working with.

Perfect! I can see your current structure. Here's how to implement efficient similarity matching:

## Database Changes Needed

1. **Add location coordinates** to the `idea` table:

```sql
ALTER TABLE idea ADD COLUMN latitude DECIMAL(10, 8);
ALTER TABLE idea ADD COLUMN longitude DECIMAL(11, 8);
```

2. **Add bio embedding vector** to the `user` table:

```sql
-- Enable the vector extension first
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE user ADD COLUMN bio_embedding vector(1536); -- OpenAI embeddings are 1536 dimensions
```

3. **Add indexes for efficient querying**:

```sql
-- For location-based queries (PostGIS would be better but this works)
CREATE INDEX idx_idea_location ON idea (latitude, longitude);

-- For pace/distance similarity
CREATE INDEX idx_idea_pace_distance ON idea (target_seconds_per_km, target_meters);

-- For vector similarity (cosine distance)
CREATE INDEX ON user USING ivfflat (bio_embedding vector_cosine_ops);
```

## Similarity Calculation Function

Create a PostgreSQL function to calculate weighted similarity:

```sql
CREATE OR REPLACE FUNCTION calculate_run_similarity(
    user1_id INTEGER,
    user2_id INTEGER,
    idea1_id INTEGER,
    idea2_id INTEGER
) RETURNS DECIMAL AS $$
DECLARE
    location_weight DECIMAL := 0.5;
    pace_weight DECIMAL := 0.25;
    distance_weight DECIMAL := 0.15;
    bio_weight DECIMAL := 0.1;

    location_distance DECIMAL;
    pace_similarity DECIMAL;
    distance_similarity DECIMAL;
    bio_similarity DECIMAL;
    total_similarity DECIMAL;
BEGIN
    -- Calculate location distance (haversine formula simplified)
    SELECT
        6371 * acos(
            cos(radians(i1.latitude)) * cos(radians(i2.latitude)) *
            cos(radians(i2.longitude) - radians(i1.longitude)) +
            sin(radians(i1.latitude)) * sin(radians(i2.latitude))
        )
    INTO location_distance
    FROM idea i1, idea i2
    WHERE i1.id = idea1_id AND i2.id = idea2_id;

    -- Location similarity (closer = higher score, max distance considered: 50km)
    location_distance := LEAST(location_distance, 50);

    -- Calculate pace similarity (seconds per km)
    SELECT
        1 - (ABS(i1.target_seconds_per_km - i2.target_seconds_per_km) / 300.0) -- 5 min difference = 0 similarity
    INTO pace_similarity
    FROM idea i1, idea i2
    WHERE i1.id = idea1_id AND i2.id = idea2_id;
    pace_similarity := GREATEST(pace_similarity, 0);

    -- Calculate distance similarity (meters)
    SELECT
        1 - (ABS(i1.target_meters - i2.target_meters) / 20000.0) -- 20km difference = 0 similarity
    INTO distance_similarity
    FROM idea i1, idea i2
    WHERE i1.id = idea1_id AND i2.id = idea2_id;
    distance_similarity := GREATEST(distance_similarity, 0);

    -- Calculate bio similarity (cosine similarity)
    SELECT
        1 - (u1.bio_embedding <=> u2.bio_embedding) -- <=> is cosine distance
    INTO bio_similarity
    FROM "user" u1, "user" u2
    WHERE u1.id = user1_id AND u2.id = user2_id;

    -- Weighted total
    total_similarity :=
        (1 - location_distance / 50) * location_weight +
        pace_similarity * pace_weight +
        distance_similarity * distance_weight +
        COALESCE(bio_similarity, 0) * bio_weight;

    RETURN total_similarity;
END;
$$ LANGUAGE plpgsql;
```

## TypeScript Implementation

```typescript
// types/matching.ts
export interface RunMatchCandidate {
  userId: number;
  ideaId: number;
  displayName: string;
  bio: string;
  targetPace: number; // seconds per km
  targetDistance: number; // meters
  location: string;
  latitude: number;
  longitude: number;
  similarity: number;
  profilePics: string[];
}

// services/matchingService.ts
import { supabase } from "@/lib/supabase";

export class MatchingService {
  static async getRunMatches(
    currentUserId: number,
    currentIdeaId: number,
  ): Promise<RunMatchCandidate[]> {
    const { data, error } = await supabase.rpc("get_run_matches", {
      current_user_id: currentUserId,
      current_idea_id: currentIdeaId,
    });

    if (error) throw error;
    return data;
  }

  static async updateBioEmbedding(userId: number, bio: string) {
    // Generate embedding using OpenAI
    const embedding = await this.generateEmbedding(bio);

    const { error } = await supabase
      .from("user")
      .update({ bio_embedding: embedding })
      .eq("id", userId);

    if (error) throw error;
  }

  private static async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-3-small",
      }),
    });

    const data = await response.json();
    return data.data[0].embedding;
  }
}
```

## SQL Function for Getting Matches

```sql
CREATE OR REPLACE FUNCTION get_run_matches(
    current_user_id INTEGER,
    current_idea_id INTEGER
) RETURNS TABLE (
    user_id INTEGER,
    idea_id INTEGER,
    display_name TEXT,
    bio TEXT,
    target_pace INTEGER,
    target_distance INTEGER,
    location TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    similarity DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id as user_id,
        i.id as idea_id,
        u.display_name,
        u.bio,
        i.target_seconds_per_km as target_pace,
        i.target_meters as target_distance,
        i.location,
        i.latitude,
        i.longitude,
        calculate_run_similarity(current_user_id, u.id, current_idea_id, i.id) as similarity
    FROM "user" u
    JOIN idea i ON i.user = u.id
    WHERE u.id != current_user_id
    AND i.id != current_idea_id
    AND i.date_range_start <= (SELECT date_range_end FROM idea WHERE id = current_idea_id)
    AND i.date_range_end >= (SELECT date_range_start FROM idea WHERE id = current_idea_id)
    ORDER BY similarity DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;
```

## Additional Considerations

1. **Location Input**: Use a service like Google Places API to convert location strings to lat/lng coordinates when users enter locations.

2. **Real-time Updates**: Cache similarity scores and regenerate when ideas change. Use Redis for caching if needed.

3. **Embedding Updates**: Regenerate bio embeddings whenever bio changes (hook this into your profile update logic).

4. **Distance Thresholds**: Consider adding user preferences for maximum distance they're willing to travel.

5. **Time Zone Handling**: Store and compare dates in UTC but consider local time zones for matching.

The weights I suggested (50% location, 25% pace, 15% distance, 10% bio) prioritize location heavily as you mentioned, but you can adjust these based on user feedback and A/B testing.

```sql
ALTER TABLE idea ADD COLUMN latitude DECIMAL(10, 8);
ALTER TABLE idea ADD COLUMN longitude DECIMAL(11, 8);
```

```sql
-- Enable the vector extension first
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE user ADD COLUMN bio_embedding vector(1536); -- OpenAI embeddings are 1536 dimensions
```

```sql
-- For location-based queries (PostGIS would be better but this works)
CREATE INDEX idx_idea_location ON idea (latitude, longitude);

-- For pace/distance similarity
CREATE INDEX idx_idea_pace_distance ON idea (target_seconds_per_km, target_meters);

-- For vector similarity (cosine distance)
CREATE INDEX ON user USING ivfflat (bio_embedding vector_cosine_ops);
```

```sql
CREATE OR REPLACE FUNCTION calculate_run_similarity(
    user1_id INTEGER,
    user2_id INTEGER,
    idea1_id INTEGER,
    idea2_id INTEGER
) RETURNS DECIMAL AS $$
DECLARE
    location_weight DECIMAL := 0.5;
    pace_weight DECIMAL := 0.25;
    distance_weight DECIMAL := 0.15;
    bio_weight DECIMAL := 0.1;

    location_distance DECIMAL;
    pace_similarity DECIMAL;
    distance_similarity DECIMAL;
    bio_similarity DECIMAL;
    total_similarity DECIMAL;
BEGIN
    -- Calculate location distance (haversine formula simplified)
    SELECT
        6371 * acos(
            cos(radians(i1.latitude)) * cos(radians(i2.latitude)) *
            cos(radians(i2.longitude) - radians(i1.longitude)) +
            sin(radians(i1.latitude)) * sin(radians(i2.latitude))
        )
    INTO location_distance
    FROM idea i1, idea i2
    WHERE i1.id = idea1_id AND i2.id = idea2_id;

    -- Location similarity (closer = higher score, max distance considered: 50km)
    location_distance := LEAST(location_distance, 50);

    -- Calculate pace similarity (seconds per km)
    SELECT
        1 - (ABS(i1.target_seconds_per_km - i2.target_seconds_per_km) / 300.0) -- 5 min difference = 0 similarity
    INTO pace_similarity
    FROM idea i1, idea i2
    WHERE i1.id = idea1_id AND i2.id = idea2_id;
    pace_similarity := GREATEST(pace_similarity, 0);

    -- Calculate distance similarity (meters)
    SELECT
        1 - (ABS(i1.target_meters - i2.target_meters) / 20000.0) -- 20km difference = 0 similarity
    INTO distance_similarity
    FROM idea i1, idea i2
    WHERE i1.id = idea1_id AND i2.id = idea2_id;
    distance_similarity := GREATEST(distance_similarity, 0);

    -- Calculate bio similarity (cosine similarity)
    SELECT
        1 - (u1.bio_embedding <=> u2.bio_embedding) -- <=> is cosine distance
    INTO bio_similarity
    FROM "user" u1, "user" u2
    WHERE u1.id = user1_id AND u2.id = user2_id;

    -- Weighted total
    total_similarity :=
        (1 - location_distance / 50) * location_weight +
        pace_similarity * pace_weight +
        distance_similarity * distance_weight +
        COALESCE(bio_similarity, 0) * bio_weight;

    RETURN total_similarity;
END;
$$ LANGUAGE plpgsql;
```

```typescript
// types/matching.ts
export interface RunMatchCandidate {
  userId: number;
  ideaId: number;
  displayName: string;
  bio: string;
  targetPace: number; // seconds per km
  targetDistance: number; // meters
  location: string;
  latitude: number;
  longitude: number;
  similarity: number;
  profilePics: string[];
}

// services/matchingService.ts
import { supabase } from "@/lib/supabase";

export class MatchingService {
  static async getRunMatches(
    currentUserId: number,
    currentIdeaId: number,
  ): Promise<RunMatchCandidate[]> {
    const { data, error } = await supabase.rpc("get_run_matches", {
      current_user_id: currentUserId,
      current_idea_id: currentIdeaId,
    });

    if (error) throw error;
    return data;
  }

  static async updateBioEmbedding(userId: number, bio: string) {
    // Generate embedding using OpenAI
    const embedding = await this.generateEmbedding(bio);

    const { error } = await supabase
      .from("user")
      .update({ bio_embedding: embedding })
      .eq("id", userId);

    if (error) throw error;
  }

  private static async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-3-small",
      }),
    });

    const data = await response.json();
    return data.data[0].embedding;
  }
}
```

```sql
CREATE OR REPLACE FUNCTION get_run_matches(
    current_user_id INTEGER,
    current_idea_id INTEGER
) RETURNS TABLE (
    user_id INTEGER,
    idea_id INTEGER,
    display_name TEXT,
    bio TEXT,
    target_pace INTEGER,
    target_distance INTEGER,
    location TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    similarity DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id as user_id,
        i.id as idea_id,
        u.display_name,
        u.bio,
        i.target_seconds_per_km as target_pace,
        i.target_meters as target_distance,
        i.location,
        i.latitude,
        i.longitude,
        calculate_run_similarity(current_user_id, u.id, current_idea_id, i.id) as similarity
    FROM "user" u
    JOIN idea i ON i.user = u.id
    WHERE u.id != current_user_id
    AND i.id != current_idea_id
    AND i.date_range_start <= (SELECT date_range_end FROM idea WHERE id = current_idea_id)
    AND i.date_range_end >= (SELECT date_range_start FROM idea WHERE id = current_idea_id)
    ORDER BY similarity DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;
```

---

**User**

is it more efficient to do it from SQL or form the nextjs code?

---

**Cursor**

For this specific use case, **SQL is significantly more efficient**. Here's why:

## Why SQL Wins

**Data Volume**: You're potentially comparing every user against every other user. If you have 10k users, that's 100M comparisons. Doing this in Next.js means:

- Fetching all user/idea data to the app server
- 100M distance calculations in JavaScript
- Massive memory usage
- Network bandwidth waste

**SQL Advantages**:

- Calculations happen on the database server (closer to data)
- No network transfer of raw data
- Native vector operations with pgvector
- Optimized distance calculations
- Built-in sorting and limiting

## Hybrid Approach (Best of Both)

But you don't have to choose one or the other. Here's the optimal strategy:

```sql
-- SQL handles the heavy lifting: filtering, basic similarity, sorting
CREATE OR REPLACE FUNCTION get_run_matches_optimized(
    current_user_id INTEGER,
    current_idea_id INTEGER,
    max_distance_km INTEGER DEFAULT 25,
    min_similarity DECIMAL DEFAULT 0.3
) RETURNS TABLE (
    user_id INTEGER,
    idea_id INTEGER,
    display_name TEXT,
    bio TEXT,
    target_pace INTEGER,
    target_distance INTEGER,
    location TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    base_similarity DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        i.id,
        u.display_name,
        u.bio,
        i.target_seconds_per_km,
        i.target_meters,
        i.location,
        i.latitude,
        i.longitude,
        -- Simplified similarity in SQL for initial filtering
        (
            (1 - LEAST(calculate_distance_km(
                (SELECT latitude FROM idea WHERE id = current_idea_id),
                (SELECT longitude FROM idea WHERE id = current_idea_id),
                i.latitude, i.longitude
            ), max_distance_km) / max_distance_km) * 0.6 +
            calculate_pace_similarity(current_idea_id, i.id) * 0.4
        ) as base_similarity
    FROM "user" u
    JOIN idea i ON i.user = u.id
    WHERE u.id != current_user_id
    AND i.id != current_idea_id
    -- Pre-filter by distance (huge performance gain)
    AND calculate_distance_km(
        (SELECT latitude FROM idea WHERE id = current_idea_id),
        (SELECT longitude FROM idea WHERE id = current_idea_id),
        i.latitude, i.longitude
    ) <= max_distance_km
    -- Pre-filter by date overlap
    AND i.date_range_start <= (SELECT date_range_end FROM idea WHERE id = current_idea_id)
    AND i.date_range_end >= (SELECT date_range_start FROM idea WHERE id = current_idea_id)
    ORDER BY base_similarity DESC
    LIMIT 100; -- Get top 100 candidates
END;
$$ LANGUAGE plpgsql;
```

```typescript
// Next.js handles complex business logic and user-specific preferences
export class MatchingService {
  static async getRunMatches(
    currentUserId: number,
    currentIdeaId: number,
    userPreferences?: MatchingPreferences,
  ): Promise<RunMatchCandidate[]> {
    // SQL gets the initial filtered set
    const { data: candidates, error } = await supabase.rpc(
      "get_run_matches_optimized",
      {
        current_user_id: currentUserId,
        current_idea_id: currentIdeaId,
        max_distance_km: userPreferences?.maxDistance || 25,
      },
    );

    if (error) throw error;

    // Next.js handles complex scoring and personalization
    return candidates
      .map((candidate) => ({
        ...candidate,
        finalScore: this.calculatePersonalizedScore(candidate, userPreferences),
        compatibility: this.calculateCompatibility(candidate),
        riskFactors: this.assessRiskFactors(candidate),
      }))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 20); // Final top 20
  }

  private static calculatePersonalizedScore(
    candidate: any,
    prefs?: MatchingPreferences,
  ): number {
    // Complex business logic that's easier in TypeScript
    let score = candidate.base_similarity;

    // Time preference matching
    if (prefs?.preferredTimeOfDay) {
      score *= this.timeOfDayMultiplier(candidate, prefs.preferredTimeOfDay);
    }

    // Running style preferences
    if (prefs?.runningStyle) {
      score *= this.runningStyleCompatibility(
        candidate.bio,
        prefs.runningStyle,
      );
    }

    // Age compatibility (if they've set preferences)
    if (prefs?.ageRange) {
      score *= this.ageCompatibility(candidate, prefs.ageRange);
    }

    return score;
  }
}
```

## Performance Comparison

**SQL-first approach**:

- Database: 10k users → 100 candidates (filtered) in ~50ms
- Next.js: 100 candidates → 20 final matches in ~5ms
- Total: ~55ms

**Next.js-first approach**:

- Database: Fetch all 10k users in ~200ms
- Next.js: 100M calculations in ~5000ms
- Total: ~5200ms

## When to Use Each

**Use SQL for**:

- Geographic filtering (huge performance gains)
- Basic similarity calculations
- Date range filtering
- Vector similarity (with pgvector)
- Initial sorting and limiting

**Use Next.js for**:

- Complex business logic
- User preference integration
- A/B testing different algorithms
- Machine learning model inference
- Real-time personalization
- Caching strategies

The hybrid approach gives you the best of both: SQL's raw performance for data-heavy operations and Next.js's flexibility for complex logic.

```sql
-- SQL handles the heavy lifting: filtering, basic similarity, sorting
CREATE OR REPLACE FUNCTION get_run_matches_optimized(
    current_user_id INTEGER,
    current_idea_id INTEGER,
    max_distance_km INTEGER DEFAULT 25,
    min_similarity DECIMAL DEFAULT 0.3
) RETURNS TABLE (
    user_id INTEGER,
    idea_id INTEGER,
    display_name TEXT,
    bio TEXT,
    target_pace INTEGER,
    target_distance INTEGER,
    location TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    base_similarity DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        i.id,
        u.display_name,
        u.bio,
        i.target_seconds_per_km,
        i.target_meters,
        i.location,
        i.latitude,
        i.longitude,
        -- Simplified similarity in SQL for initial filtering
        (
            (1 - LEAST(calculate_distance_km(
                (SELECT latitude FROM idea WHERE id = current_idea_id),
                (SELECT longitude FROM idea WHERE id = current_idea_id),
                i.latitude, i.longitude
            ), max_distance_km) / max_distance_km) * 0.6 +
            calculate_pace_similarity(current_idea_id, i.id) * 0.4
        ) as base_similarity
    FROM "user" u
    JOIN idea i ON i.user = u.id
    WHERE u.id != current_user_id
    AND i.id != current_idea_id
    -- Pre-filter by distance (huge performance gain)
    AND calculate_distance_km(
        (SELECT latitude FROM idea WHERE id = current_idea_id),
        (SELECT longitude FROM idea WHERE id = current_idea_id),
        i.latitude, i.longitude
    ) <= max_distance_km
    -- Pre-filter by date overlap
    AND i.date_range_start <= (SELECT date_range_end FROM idea WHERE id = current_idea_id)
    AND i.date_range_end >= (SELECT date_range_start FROM idea WHERE id = current_idea_id)
    ORDER BY base_similarity DESC
    LIMIT 100; -- Get top 100 candidates
END;
$$ LANGUAGE plpgsql;
```

```typescript
// Next.js handles complex business logic and user-specific preferences
export class MatchingService {
  static async getRunMatches(
    currentUserId: number,
    currentIdeaId: number,
    userPreferences?: MatchingPreferences,
  ): Promise<RunMatchCandidate[]> {
    // SQL gets the initial filtered set
    const { data: candidates, error } = await supabase.rpc(
      "get_run_matches_optimized",
      {
        current_user_id: currentUserId,
        current_idea_id: currentIdeaId,
        max_distance_km: userPreferences?.maxDistance || 25,
      },
    );

    if (error) throw error;

    // Next.js handles complex scoring and personalization
    return candidates
      .map((candidate) => ({
        ...candidate,
        finalScore: this.calculatePersonalizedScore(candidate, userPreferences),
        compatibility: this.calculateCompatibility(candidate),
        riskFactors: this.assessRiskFactors(candidate),
      }))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 20); // Final top 20
  }

  private static calculatePersonalizedScore(
    candidate: any,
    prefs?: MatchingPreferences,
  ): number {
    // Complex business logic that's easier in TypeScript
    let score = candidate.base_similarity;

    // Time preference matching
    if (prefs?.preferredTimeOfDay) {
      score *= this.timeOfDayMultiplier(candidate, prefs.preferredTimeOfDay);
    }

    // Running style preferences
    if (prefs?.runningStyle) {
      score *= this.runningStyleCompatibility(
        candidate.bio,
        prefs.runningStyle,
      );
    }

    // Age compatibility (if they've set preferences)
    if (prefs?.ageRange) {
      score *= this.ageCompatibility(candidate, prefs.ageRange);
    }

    return score;
  }
}
```
