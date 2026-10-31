/**
 * Shuffles an array using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} A new shuffled array.
 */
export function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Calculates the Levenshtein distance between two strings.
 * Useful for fuzzy string matching.
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @returns {number} The distance between the strings.
 */
export function distance(a, b) {
  if (!a || !b) return (a || "").length + (b || "").length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Helper to pluralize words based on count.
 * @param {number} count - The number of items.
 * @param {string} word - The singular form of the word.
 * @returns {string} The formatted plural/singular string.
 */
export function pluralHelper(count, word) {
  return `${count} ${count === 1 ? word : word + 's'}`;
}

/**
 * Converts a file to a base64 string.
 * @param {File} file - The file object.
 * @returns {Promise<string>} A promise that resolves to the base64 string.
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}
