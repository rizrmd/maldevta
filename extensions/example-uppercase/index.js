/**
 * Example Extension: Uppercase Transformer
 * 
 * This extension demonstrates how to create a simple text transformation
 * that converts input to uppercase in the pre-generate phase.
 */

/**
 * Pre-generate hook: Transform user prompt before sending to LLM
 * @param {Object} request - The execution request
 * @param {string} request.input - The user's prompt
 * @param {string} request.projectId - The project ID
 * @param {Object} request.context - Additional context
 * @returns {string} - Transformed prompt
 */
function preGenerate(request) {
    console.log("Running uppercase transformation on prompt");
    
    // Simple transformation: convert to uppercase
    const transformed = request.input.toUpperCase();
    
    return transformed;
}

/**
 * Post-generate hook: Transform LLM response before returning to user
 * @param {Object} request - The execution request
 * @param {string} request.input - The LLM's response
 * @returns {string} - Transformed response
 */
function postGenerate(request) {
    console.log("Post-processing LLM response");
    
    // You can modify the response here
    // For this example, we'll just return it as-is
    return request.input;
}
