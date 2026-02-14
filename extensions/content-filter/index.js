/**
 * Example Extension: Content Filter
 * 
 * This extension demonstrates validation and content filtering capabilities.
 * It checks for prohibited words and can sanitize content.
 */

// Configuration - these would come from extension.config in production
const PROHIBITED_WORDS = ['spam', 'hack', 'exploit'];
const MAX_LENGTH = 10000;

/**
 * Validate hook: Check if the input meets requirements
 * @param {Object} request - The execution request
 * @returns {Object} - Validation result
 */
function validate(request) {
    const input = request.input;
    const errors = [];
    
    // Check length
    if (input.length > MAX_LENGTH) {
        errors.push(`Input too long: ${input.length} chars (max: ${MAX_LENGTH})`);
    }
    
    // Check for prohibited words
    const lowerInput = input.toLowerCase();
    for (const word of PROHIBITED_WORDS) {
        if (lowerInput.includes(word)) {
            errors.push(`Prohibited word detected: ${word}`);
        }
    }
    
    if (errors.length > 0) {
        return {
            output: JSON.stringify({
                valid: false,
                errors: errors
            })
        };
    }
    
    return {
        output: JSON.stringify({
            valid: true,
            errors: []
        })
    };
}

/**
 * Pre-generate hook: Sanitize input before sending to LLM
 * @param {Object} request - The execution request
 * @returns {string} - Sanitized input
 */
function preGenerate(request) {
    console.log("Filtering content before generation");
    
    let sanitized = request.input;
    
    // Remove any prohibited words (simple replacement)
    for (const word of PROHIBITED_WORDS) {
        const regex = new RegExp(word, 'gi');
        sanitized = sanitized.replace(regex, '[FILTERED]');
    }
    
    // Trim excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
}

/**
 * Post-generate hook: Filter LLM response
 * @param {Object} request - The execution request
 * @returns {string} - Filtered response
 */
function postGenerate(request) {
    console.log("Filtering LLM response");
    
    let output = request.input;
    
    // Apply the same filtering to output
    for (const word of PROHIBITED_WORDS) {
        const regex = new RegExp(word, 'gi');
        output = output.replace(regex, '[FILTERED]');
    }
    
    return output;
}
