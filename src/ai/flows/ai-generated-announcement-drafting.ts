'use server';
/**
 * @fileOverview A Genkit flow for drafting clear and professional announcements or messages for students.
 *
 * - draftAnnouncement - A function that handles the announcement drafting process.
 * - DraftAnnouncementInput - The input type for the draftAnnouncement function.
 * - DraftAnnouncementOutput - The return type for the draftAnnouncement function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DraftAnnouncementInputSchema = z.object({
  topic: z.string().describe('The main topic or keywords for the announcement.'),
  targetAudience: z.enum(['students', 'staff', 'all']).describe('The target audience for the announcement. Can be "students", "staff", or "all".'),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).describe('The urgency level of the announcement.'),
  keyDetails: z.string().optional().describe('Any specific details or points to include in the announcement.'),
});
export type DraftAnnouncementInput = z.infer<typeof DraftAnnouncementInputSchema>;

const DraftAnnouncementOutputSchema = z.object({
  draftedMessage: z.string().describe('The AI-generated announcement message.'),
});
export type DraftAnnouncementOutput = z.infer<typeof DraftAnnouncementOutputSchema>;

export async function draftAnnouncement(input: DraftAnnouncementInput): Promise<DraftAnnouncementOutput> {
  return draftAnnouncementFlow(input);
}

const announcementDraftingPrompt = ai.definePrompt({
  name: 'announcementDraftingPrompt',
  input: {schema: DraftAnnouncementInputSchema},
  output: {schema: DraftAnnouncementOutputSchema},
  prompt: `You are an AI assistant for the Hostel In campus management. Your task is to draft a clear, professional, and concise announcement or message for the hostel community.

Topic: {{{topic}}}
Target Audience: {{{targetAudience}}}
Urgency: {{{urgency}}}
{{#if keyDetails}}
Key Details to Include: {{{keyDetails}}}
{{/if}}

Please draft the announcement. Ensure it is appropriate for the specified audience and reflects the urgency.`,
});

const draftAnnouncementFlow = ai.defineFlow(
  {
    name: 'draftAnnouncementFlow',
    inputSchema: DraftAnnouncementInputSchema,
    outputSchema: DraftAnnouncementOutputSchema,
  },
  async input => {
    const {output} = await announcementDraftingPrompt(input);
    return output!;
  }
);
