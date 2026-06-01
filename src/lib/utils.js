export const normalizeText = (text) => {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export const formatNotesWithLineBreaks = (notesStr) => {
  if (!notesStr) return '';
  return String(notesStr)
    .replace(/(\s*)(\b\d{2}\/\d{2}\/\d{2,4}\b)/g, (match, whitespace, datePart, offset) => {
      if (offset === 0) {
        return datePart;
      }
      if (whitespace.includes('\n')) {
        return match;
      }
      return '\n' + datePart;
    })
    .trim();
};
