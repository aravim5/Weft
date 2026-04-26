/**
 * Job 10 — Cluster Team Concerns (AI_JOB_SPECS.md §Job 10)
 *
 * Group open team concerns across designers into meaningful clusters.
 * Singletons become orphans. Results are cached — not written per-request.
 *
 * Model: Sonnet | Temp: 0.2 | Writes: cached result (not per-user-action)
 */
import { z } from "zod";
import { callSonnet } from "@/lib/claude";

// ── Input type ──────────────────────────────────────────────────────────────────

export interface ClusterTeamConcernsInput {
  concerns: Array<{
    id: string;
    concern: string;
    theme: string;
    severity: string;
    raisedByDesignerName: string;
    createdAt: string;
    status: string;
  }>;
}

// ── Response schema (validated by Zod before caching) ──────────────────────────

export const responseSchema = z.object({
  clusters: z.array(
    z.object({
      label: z.string(),
      theme: z.string(),
      concernIds: z.array(z.string()),
      raisedByCount: z.number(),
      severityHighWatermark: z.enum(["low", "med", "high"]),
      summary: z.string(),
      recommendedAttention: z.enum(["watch", "act", "urgent"]),
    })
  ),
  orphans: z.array(z.string()), // concern IDs that are singletons
  generatedAt: z.string(),
});

export type ClusterTeamConcernsOutput = z.infer<typeof responseSchema>;

// ── Tool schema (mirrors responseSchema as JSON Schema for tool_use) ──────────────

const TOOL_SCHEMA = {
  properties: {
    clusters: {
      type: "array",
      description:
        "Groups of concerns that multiple designers have raised about a similar topic. Maximum 6 clusters. Only include a cluster if ≥2 designers contributed.",
      items: {
        type: "object",
        required: ["label", "theme", "concernIds", "raisedByCount", "severityHighWatermark", "summary", "recommendedAttention"],
        properties: {
          label: {
            type: "string",
            description:
              "Short, descriptive label for the cluster (e.g. 'Unclear design review process', 'Cross-team collaboration friction'). Descriptive, not accusatory. Under 60 characters.",
          },
          theme: {
            type: "string",
            description:
              "The dominant theme across the concerns in this cluster. Use the theme values from the concerns where possible.",
          },
          concernIds: {
            type: "array",
            items: { type: "string" },
            description: "IDs of all concerns grouped into this cluster.",
          },
          raisedByCount: {
            type: "number",
            description: "Number of distinct designers who raised concerns in this cluster.",
          },
          severityHighWatermark: {
            type: "string",
            enum: ["low", "med", "high"],
            description: "The highest severity level among all concerns in this cluster.",
          },
          summary: {
            type: "string",
            description:
              "2–4 sentence synthesis of the shared concern across designers. What is the pattern? What does it feel like from the team's perspective? Do not propose solutions.",
          },
          recommendedAttention: {
            type: "string",
            enum: ["watch", "act", "urgent"],
            description:
              "'urgent' only for ≥3 designers OR high severity from ≥2 designers. 'act' for ≥2 designers with med/high severity. 'watch' for ≥2 designers with low severity.",
          },
        },
      },
    },
    orphans: {
      type: "array",
      items: { type: "string" },
      description:
        "IDs of concerns that did not cluster with any other concern — either unique topic or only raised by one designer. These are singletons.",
    },
    generatedAt: {
      type: "string",
      description: "ISO timestamp of when this clustering was generated. Use the current time.",
    },
  },
  required: ["clusters", "orphans", "generatedAt"],
};

// ── System prompt ───────────────────────────────────────────────────────────────

export const systemPrompt = `You are an analyst helping a design team manager understand patterns in concerns their team has raised over time.

Your job is to read a list of team concerns and cluster them into meaningful groups — so the manager can see where multiple designers are feeling the same thing, rather than seeing each concern in isolation.

CLUSTERING RULES:
1. Cluster only when ≥2 designers raised similar concerns. A concern raised by only one person is a singleton — put it in orphans, not a cluster.
2. Cluster by underlying theme and felt experience, not just keyword matching. "Too many meetings" and "process is slowing us down" may belong together even if the words differ.
3. Maximum 6 clusters total. If you'd have more, merge the smaller/weaker ones into the most thematically close cluster or move them to orphans.
4. Labels must be descriptive and neutral — never accusatory, never naming individuals. Under 60 characters.
5. recommendedAttention="urgent" ONLY when ≥3 designers are in the cluster OR high severity from ≥2 designers. Be conservative.
6. Do not propose solutions or recommendations for action. Just surface the pattern. That is Ravi's call.
7. summary: synthesise the shared experience. What does this feel like from the team's perspective? Not a list of the individual concerns — a coherent narrative of the pattern.
8. raisedByCount: count distinct designers, not number of concerns.
9. If there are fewer than 4 concerns total, it is likely correct to have 0 or 1 clusters and mostly orphans.
10. generatedAt: use the current UTC time in ISO 8601 format.`;

// ── User prompt builder ─────────────────────────────────────────────────────────

export function buildUserPrompt(input: ClusterTeamConcernsInput): string {
  if (input.concerns.length === 0) {
    return `There are no open team concerns to cluster at this time. Return an empty clusters array, an empty orphans array, and set generatedAt to the current UTC time.`;
  }

  const concernsList = input.concerns
    .map(
      (c) =>
        `- ID: ${c.id}
  Designer: ${c.raisedByDesignerName}
  Concern: ${c.concern}
  Theme: ${c.theme}
  Severity: ${c.severity}
  Raised: ${c.createdAt}
  Status: ${c.status}`
    )
    .join("\n\n");

  return `Cluster the following ${input.concerns.length} open team concern${input.concerns.length === 1 ? "" : "s"} from across the design team.

CONCERNS:
${concernsList}

---

Group concerns where ≥2 designers raised something similar into clusters. Everything else goes in orphans.
Remember: maximum 6 clusters, no solutions, descriptive labels only.`;
}

// ── Post-processing: enforce raisedByCount ≥ 2 ─────────────────────────────────

function enforceClusterMinimum(output: ClusterTeamConcernsOutput): ClusterTeamConcernsOutput {
  const validClusters: typeof output.clusters = [];
  const additionalOrphans: string[] = [];

  for (const cluster of output.clusters) {
    if (cluster.raisedByCount < 2) {
      // Move all concern IDs from this under-populated cluster into orphans
      additionalOrphans.push(...cluster.concernIds);
    } else {
      validClusters.push(cluster);
    }
  }

  return {
    ...output,
    clusters: validClusters,
    orphans: [...output.orphans, ...additionalOrphans],
  };
}

// ── run() ───────────────────────────────────────────────────────────────────────

export async function run(input: ClusterTeamConcernsInput): Promise<ClusterTeamConcernsOutput> {
  const result = await callSonnet(
    "cluster-team-concerns",
    systemPrompt,
    buildUserPrompt(input),
    {
      toolName: "submit_concern_clusters",
      toolDescription: "Submit the clustered team concerns analysis.",
      toolSchema: TOOL_SCHEMA,
      responseSchema,
    },
    0.2,
  );

  return enforceClusterMinimum(result);
}
