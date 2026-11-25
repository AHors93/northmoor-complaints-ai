const RESERVED_PHONES = ['07700900', '02079460', '01174960', '01214960', '01614960'];

/** Emails and UK phone numbers that could belong to a real person. */
export function findReachableContacts(text: string): string[] {
  const emails = text.match(/[\w.+'-]+@[\w.-]*\w/g) ?? [];
  const phones = text.match(/(?<![\d-])(?:\+44|0)(?: ?\d){9,10}(?![\d-])/g) ?? [];
  return [
    ...emails.filter((e) => !/@example\.(com|org|net)$/i.test(e)),
    ...phones.filter((p) => {
      const national = p.replace('+44', '0').replaceAll(' ', '');
      return !RESERVED_PHONES.some((r) => national.startsWith(r) && national.length === 11);
    }),
  ];
}
