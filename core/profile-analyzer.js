/**
 * ProfileAnalyzer - Extracts structured profile data from LinkedIn profile DOM
 * 
 * ANTI-BAN COMPLIANCE:
 * - Only reads visible DOM elements
 * - No API calls or network requests
 * - Works only on the current profile page
 */

class ProfileAnalyzer {
    /**
     * Analyze the LinkedIn profile page and extract relevant information
     * @param {Element} profileRootElement - The root element of the profile (usually document.body)
     * @returns {Object} Structured profile data
     */
    static analyze(profileRootElement = document.body) {
        const profileId = this.extractProfileId();
        const name = this.extractName(profileRootElement);
        const headline = this.extractHeadline(profileRootElement);
        const company = this.extractCurrentCompany(profileRootElement);
        const recentActivitySnippet = this.extractRecentActivity(profileRootElement);
        const featuredHighlight = this.extractFeaturedHighlight(profileRootElement);

        return {
            profileId,
            name,
            headline,
            company,
            recentActivitySnippet,
            featuredHighlight,
            extractedAt: new Date().toISOString()
        };
    }

    /**
     * Extract profile ID from the current URL
     * @returns {string} Profile ID or empty string
     */
    static extractProfileId() {
        try {
            const url = window.location.href;
            const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
            return match ? match[1] : '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting profile ID:', e);
            return '';
        }
    }

    /**
     * Extract the person's name from the profile
     * @param {Element} root - Root element to search within
     * @returns {string} Name or empty string
     */
    static extractName(root) {
        try {
            // Primary: Look for h1 in the main profile section
            const h1 = root.querySelector('h1');
            if (h1 && h1.textContent) {
                return h1.textContent.trim();
            }

            // Fallback: Look for specific profile name classes
            const nameElement = root.querySelector('.text-heading-xlarge') ||
                root.querySelector('[data-anonymize="person-name"]');
            if (nameElement) {
                return nameElement.textContent.trim();
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting name:', e);
            return '';
        }
    }

    /**
     * Extract the headline/title from the profile
     * @param {Element} root - Root element to search within
     * @returns {string} Headline or empty string
     */
    static extractHeadline(root) {
        try {
            // Primary: Look for the text-body-medium class used for headlines
            const headlineElement = root.querySelector('.text-body-medium');
            if (headlineElement && headlineElement.textContent) {
                return headlineElement.textContent.trim();
            }

            // Fallback: Look for headline in the profile header area
            const headerSection = root.querySelector('.pv-text-details__left-panel');
            if (headerSection) {
                const headline = headerSection.querySelector('.text-body-medium');
                if (headline) {
                    return headline.textContent.trim();
                }
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting headline:', e);
            return '';
        }
    }

    /**
     * Extract current company/role from experience section
     * @param {Element} root - Root element to search within
     * @returns {string} Company/role or empty string
     */
    static extractCurrentCompany(root) {
        try {
            // Try to find experience section
            const experienceSection = root.querySelector('#experience') ||
                root.querySelector('[id*="experience"]') ||
                root.querySelector('section[data-section="experience"]');

            if (experienceSection) {
                // Look for the first experience item
                const firstExperience = experienceSection.querySelector('li') ||
                    experienceSection.querySelector('.pvs-entity');

                if (firstExperience) {
                    // Try to get company name and role
                    const roleElement = firstExperience.querySelector('.t-bold span[aria-hidden="true"]') ||
                        firstExperience.querySelector('.mr1.t-bold span');
                    const companyElement = firstExperience.querySelector('.t-normal span[aria-hidden="true"]') ||
                        firstExperience.querySelector('.t-14.t-normal span');

                    const role = roleElement ? roleElement.textContent.trim() : '';
                    const company = companyElement ? companyElement.textContent.trim() : '';

                    if (role && company) {
                        return `${role} at ${company}`;
                    } else if (role) {
                        return role;
                    } else if (company) {
                        return company;
                    }
                }
            }

            // Fallback: Look for company in the profile header
            const companyLink = root.querySelector('button[aria-label*="Current company"]') ||
                root.querySelector('[data-field="experience_company"]');
            if (companyLink) {
                return companyLink.textContent.trim();
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting company:', e);
            return '';
        }
    }

    /**
     * Extract recent activity snippet (post/comment)
     * @param {Element} root - Root element to search within
     * @returns {string} Activity snippet or empty string
     */
    static extractRecentActivity(root) {
        try {
            // Look for activity section
            const activitySection = root.querySelector('#recent-activity') ||
                root.querySelector('[id*="recent-activity"]') ||
                root.querySelector('section[data-section="activity"]') ||
                root.querySelector('.pv-recent-activity-section');

            if (activitySection) {
                // Look for post content
                const postContent = activitySection.querySelector('span[dir="ltr"]') ||
                    activitySection.querySelector('.break-words') ||
                    activitySection.querySelector('.feed-shared-text');

                if (postContent && postContent.textContent) {
                    const text = postContent.textContent.trim();
                    // Return first 200 characters of meaningful content
                    if (text.length > 0) {
                        return text.substring(0, 200) + (text.length > 200 ? '...' : '');
                    }
                }
            }

            // Alternative: Look for posts section
            const postsSection = root.querySelector('.pv-recent-activity-section__posts');
            if (postsSection) {
                const firstPost = postsSection.querySelector('.feed-shared-update-v2__description');
                if (firstPost) {
                    const text = firstPost.textContent.trim();
                    return text.substring(0, 200) + (text.length > 200 ? '...' : '');
                }
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting recent activity:', e);
            return '';
        }
    }

    /**
     * Extract featured achievements/highlights
     * @param {Element} root - Root element to search within
     * @returns {string} Featured highlight or empty string
     */
    static extractFeaturedHighlight(root) {
        try {
            // Look for featured section
            const featuredSection = root.querySelector('#featured') ||
                root.querySelector('[id*="featured"]') ||
                root.querySelector('section[data-section="featured"]') ||
                root.querySelector('.pv-featured-section');

            if (featuredSection) {
                // Look for featured item title or description
                const featuredTitle = featuredSection.querySelector('.t-bold span[aria-hidden="true"]') ||
                    featuredSection.querySelector('.pv-featured-section__title') ||
                    featuredSection.querySelector('h3');

                if (featuredTitle && featuredTitle.textContent) {
                    return featuredTitle.textContent.trim();
                }

                // Look for any descriptive text
                const featuredDesc = featuredSection.querySelector('.t-normal span[aria-hidden="true"]') ||
                    featuredSection.querySelector('p');
                if (featuredDesc && featuredDesc.textContent) {
                    return featuredDesc.textContent.trim().substring(0, 150);
                }
            }

            return '';
        } catch (e) {
            console.error('[ProfileAnalyzer] Error extracting featured highlight:', e);
            return '';
        }
    }

    /**
     * Validate that we have enough context to generate a meaningful message
     * @param {Object} profileData - The extracted profile data
     * @returns {boolean} True if we have minimum required data
     */
    static hasMinimumContext(profileData) {
        return !!(profileData.name && (profileData.headline || profileData.company));
    }
}

// Export for use in content scripts
if (typeof window !== 'undefined') {
    window.ProfileAnalyzer = ProfileAnalyzer;
}
