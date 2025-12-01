export const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

export const normalizeBooks = (books) => {
  if (!Array.isArray(books)) return [];
  return books
    .map((book) => {
      const title = normalizeString(book.title);
      if (!title) return null;
      const author = normalizeString(book.author);
      return { title, author };
    })
    .filter(Boolean);
};

export const normalizeExamDates = (examDates) => {
  if (!Array.isArray(examDates)) return [];
  return examDates.map((d) => normalizeString(d)).filter(Boolean);
};

export const normalizeEnrolments = (enrolments) => {
  if (!Array.isArray(enrolments)) return [];
  return enrolments
    .map((enrolment) => {
      const subject = normalizeString(enrolment.subject);
      if (!subject) return null;
      const level = normalizeString(enrolment.level) || null;
      const examBody = normalizeString(enrolment.examBody) || null;
      const books = normalizeBooks(enrolment.books);
      const examDates = normalizeExamDates(enrolment.examDates);
      return { subject, level, examBody, books, examDates };
    })
    .filter(Boolean);
};
