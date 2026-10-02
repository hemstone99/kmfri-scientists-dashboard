import { GoogleGenAI } from '@google/genai';

export interface AiAssistantContextSummary {
  scientistName: string;
  scientistRole: string;
  directorate: string;
  totalProjects: number;
  activeProjects: { code: string; title: string; status: string; progress: number }[];
  totalPublications: number;
  recentPublications: { title: string; type: string; status: string }[];
  totalLocations: number;
  overdueReportsCount: number;
}

export async function generateKmfriAiResponse(params: {
  prompt: string;
  taskMode?: string;
  history?: { role: 'user' | 'model'; text: string }[];
  contextSummary: AiAssistantContextSummary;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const activeList =
      params.contextSummary.activeProjects
        .map((p) => `- **${p.code}**: ${p.title} (*${p.status}*, **${p.progress}%** complete)`)
        .join('\n') || '- No active projects currently listed.';
    const pubList =
      params.contextSummary.recentPublications
        .map((o) => `- **${o.title}** (${o.type} — *${o.status}*)`)
        .join('\n') || '- No publications currently listed.';

    return `### KMFRI Scientific Synthesis (${params.taskMode || 'Institutional Advisory'})
**Prepared for:** ${params.contextSummary.scientistName} (${params.contextSummary.scientistRole}, ${params.contextSummary.directorate})

#### 1. Executive Synthesis for Query
> "${params.prompt}"

Based on live KMFRI institutional telemetry (**${params.contextSummary.totalProjects}** active projects, **${params.contextSummary.totalPublications}** peer-reviewed outputs, **${params.contextSummary.totalLocations}** GIS hydrographic stations, and **${params.contextSummary.overdueReportsCount}** overdue reports), the following research governance recommendations apply:

#### 2. Active Project Portfolio Alignment
${activeList}

#### 3. Recent Scientific Outputs & Manuscripts
${pubList}

#### 4. Recommended Methodology & Next Steps
1. **Field & Cruise Standardization**: Align station sampling protocols with RV *Mtafiti* CTD/hydro-acoustic SOPs and IPCC coastal wetland carbon tiers.
2. **Balanced Scorecard & Reporting**: Ensure quarterly technical reports and cruise event logs are updated in the KMFRI SharePoint & Word Co-Authoring Drive prior to the next review cycle.
*(Note: Running in standalone local synthesis mode. Set \`GEMINI_API_KEY\` in \`.env\` to enable live Gemini cloud generation.)*`;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = `You are the official KMFRI Scientific & Research Governance AI Assistant for the Kenya Marine and Fisheries Research Institute (KMFRI), headquartered at English Point, Mombasa, Kenya under the Ministry of Mining, Blue Economy and Maritime Affairs.

Current Authenticated Scientist Context:
- Scientist: ${params.contextSummary.scientistName} (${params.contextSummary.scientistRole})
- Directorate: ${params.contextSummary.directorate}
- Institutional Portfolio: ${params.contextSummary.totalProjects} projects, ${params.contextSummary.totalPublications} research outputs/publications, ${params.contextSummary.totalLocations} mapped GIS stations, ${params.contextSummary.overdueReportsCount} overdue reports.
- Active Projects Sample: ${
    params.contextSummary.activeProjects
      .map((p) => `${p.code}: "${p.title}" (${p.status}, ${p.progress}%)`)
      .join('; ') || 'None registered yet'
  }
- Recent Publications Sample: ${
    params.contextSummary.recentPublications
      .map((o) => `"${o.title}" [${o.type}, ${o.status}]`)
      .join('; ') || 'None registered yet'
  }

Your capabilities:
1. Draft, peer-review, and refine scientific manuscripts, executive abstracts, and WIOJMS (Western Indian Ocean Journal of Marine Science) papers.
2. Provide oceanographic, hydrographic, coral reef, mangrove blue carbon, and freshwater limnology (Lake Victoria, Lake Turkana, Lake Naivasha) research methodologies and sampling protocols (RV Mtafiti, CTD casts, transect surveys).
3. Analyze KMFRI project portfolios, grant utilization, milestones, and technical report workflows.
4. Draft Blue Economy policy briefs for Beach Management Units (BMUs), county fisheries directorates, and national marine spatial planning.

Respond with clear, rigorous, well-structured scientific prose using Markdown headings and bullet points where helpful.`;

  const historyLines = (params.history || [])
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Scientist' : 'KMFRI AI'}: ${h.text}`)
    .join('\n\n');

  const fullPrompt = historyLines
    ? `${historyLines}\n\nScientist (${params.taskMode || 'General Research Inquiry'}): ${params.prompt}`
    : `Task Mode: ${params.taskMode || 'General Research Inquiry'}\n\nScientist Prompt: ${params.prompt}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: fullPrompt,
    config: {
      systemInstruction,
      temperature: 0.7,
    },
  });

  return (
    response.text ||
    'No response text was generated. Please refine your scientific query and try again.'
  );
}
