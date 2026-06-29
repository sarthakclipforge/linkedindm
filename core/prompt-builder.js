/**
 * PromptBuilder - Builds AI prompts for generating human-sounding LinkedIn DMs
 * 
 * The prompts are carefully crafted to avoid AI-sounding language
 * and generate authentic, personalized messages.
 */

class PromptBuilder {
    /**
     * Build the system prompt for the AI
     * @returns {string} System prompt
     */
    static getSystemPrompt() {
        return `You are writing a short LinkedIn message that feels 100% human.
Your goal is to help the user send a genuine, personalized message that sounds like a real person wrote it.
You must avoid anything that sounds corporate, generic, or AI-generated.`;
    }

    /**
     * Build the main prompt with profile context
     * @param {Object} profileData - Extracted profile data
     * @returns {string} Complete prompt for message generation
     */
    static buildPrompt(profileData) {
        const { name, headline, company, recentActivities, recentActivitySnippet, featuredHighlight } = profileData;

        // Build context section with only available data
        let contextSection = '';

        if (name) {
            contextSection += `Name: ${name}\n`;
        }

        if (headline) {
            contextSection += `Headline: ${headline}\n`;
        }

        if (company) {
            contextSection += `Current Role/Company: ${company}\n`;
        }

        // Handle Array or String for activity
        if (recentActivities && Array.isArray(recentActivities) && recentActivities.length > 0) {
            contextSection += `Recent Activity (Posts):\n- ${recentActivities.join('\n- ')}\n`;
        } else if (recentActivitySnippet) {
            contextSection += `Recent Activity Snippet: ${recentActivitySnippet}\n`;
        }

        if (featuredHighlight) {
            contextSection += `Achievement or Highlight: ${featuredHighlight}\n`;
        }

        const prompt = `You are writing a short LinkedIn message that feels 100% human.

The user is viewing this person's LinkedIn profile and wants to send a message.

Context available:

${contextSection}
Instructions:

- Write a message that sounds like a real person, not AI.
- Keep it short (2–4 lines max).
- Mention ONLY what is actually present in the context.
- Do NOT overpraise or sound fake.
- Do NOT ask random or generic questions.
- Only ask a question if it naturally fits the activity shown.
- If recent activity is empty, do NOT invent anything.
  Just write a simple profile-based opener.
- Avoid corporate phrases like:
  "Hope you're doing well"
  "I wanted to reach out"
  "Touching base"
  "Hope this finds you well"
  "I'd love to connect"
  "Reaching out because"
- End smoothly without forcing a call-to-action.
- Do NOT start with "Hey" followed immediately by their name (too common in cold outreach).
- Be conversational but professional.

Output ONLY the final LinkedIn message. No explanations, no quotes around the message.`;

        return prompt;
    }

    /**
     * Build a fallback message when AI is not available
     * @param {Object} profileData - Extracted profile data
     * @returns {string} A simple template-based message
     */
    static buildFallbackMessage(profileData) {
        const { name, headline, company, recentActivities, recentActivitySnippet, featuredHighlight } = profileData;

        // Extract first name
        const firstName = name ? name.split(' ')[0] : '';

        // Helper to get latest activity text
        const latestActivity = (recentActivities && recentActivities.length > 0) ? recentActivities[0] : recentActivitySnippet;

        // Generate based on available context
        if (latestActivity && latestActivity.length > 20) {
            // Has activity - reference it
            const activityPreview = latestActivity.substring(0, 50);
            return `${firstName}, saw your recent post about "${activityPreview}..." - really interesting perspective. Would be great to connect.`;
        }

        if (featuredHighlight) {
            // Has featured content
            return `${firstName}, noticed your work on "${featuredHighlight}" - impressive stuff. Would be great to exchange ideas sometime.`;
        }

        if (company && headline) {
            // Has role info
            return `${firstName}, your background in ${headline.toLowerCase().includes('founder') || headline.toLowerCase().includes('ceo') ? 'building' : 'the'} ${company.includes(' at ') ? company.split(' at ')[1] : company} caught my attention. Would love to connect.`;
        }

        if (headline) {
            // Just headline
            return `${firstName}, your work as ${headline.split('|')[0].trim()} looks interesting. Would be great to connect.`;
        }

        // Minimal fallback
        return `${firstName}, came across your profile and found your background interesting. Would be great to connect.`;
    }

    /**
     * Clean up and format the AI response
     * @param {string} response - Raw AI response
     * @returns {string} Cleaned message
     */
    static cleanResponse(response) {
        if (!response) return '';

        let cleaned = response.trim();

        // Remove quotes if the AI wrapped the message in quotes
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
            (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
            cleaned = cleaned.slice(1, -1);
        }

        // Remove common AI prefixes
        const prefixesToRemove = [
            'Here is the message:',
            'Here\'s the message:',
            'Message:',
            'Draft:',
            'Here is your message:',
            'Here\'s your message:'
        ];

        for (const prefix of prefixesToRemove) {
            if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
                cleaned = cleaned.substring(prefix.length).trim();
            }
        }

        return cleaned;
    }
}

// Export for use in content scripts
if (typeof window !== 'undefined') {
    window.PromptBuilder = PromptBuilder;
}
