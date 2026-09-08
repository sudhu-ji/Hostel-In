'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ComplaintsSummaryInputSchema = z.object({
  complaints: z.array(z.object({
    student: z.string(),
    issue: z.string(),
    room: z.string(),
    priority: z.string(),
    status: z.string(),
    date: z.string(),
  })).describe('List of complaints to summarize.'),
});
export type ComplaintsSummaryInput = z.infer<typeof ComplaintsSummaryInputSchema>;

const ComplaintsSummaryOutputSchema = z.object({
  summary: z.string().describe('An executive summary of the common complaint themes and recommended actions.'),
});
export type ComplaintsSummaryOutput = z.infer<typeof ComplaintsSummaryOutputSchema>;

export async function summarizeComplaints(input: ComplaintsSummaryInput): Promise<ComplaintsSummaryOutput> {
  return complaintsSummaryFlow(input);
}

const complaintsSummaryPrompt = ai.definePrompt({
  name: 'complaintsSummaryPrompt',
  input: {schema: ComplaintsSummaryInputSchema},
  output: {schema: ComplaintsSummaryOutputSchema},
  prompt: `You are an AI assistant for the Hostel In campus administration.
Analyze the following list of student complaints:

{{#each complaints}}
- [Priority: {{priority}}, Status: {{status}}, Date: {{date}}, Room: {{room}}] Student {{student}}: "{{issue}}"
{{/each}}

Please provide a concise, structured, and professional executive summary of these complaints:
1. Key Themes & Patterns (e.g. electrical, plumbing, food quality, internet connectivity).
2. Urgency/Critical Areas that require immediate attention.
3. Recommended steps or action items for the Warden/Monitor to address these issues.`,
});

const complaintsSummaryFlow = ai.defineFlow(
  {
    name: 'complaintsSummaryFlow',
    inputSchema: ComplaintsSummaryInputSchema,
    outputSchema: ComplaintsSummaryOutputSchema,
  },
  async input => {
    const {output} = await complaintsSummaryPrompt(input);
    return output!;
  }
);
