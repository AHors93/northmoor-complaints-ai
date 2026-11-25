/** Faker's en_GB locale falls back to American surnames. Includes apostrophes and hyphens on purpose. */
export const SURNAMES: readonly string[] = `
Smith Jones Taylor Williams Brown Davies Evans Wilson Thomas Roberts Johnson Lewis Walker Robinson
Thompson Wright Hughes Edwards Green Hall Wood Harris Clarke Jackson Turner Hill Cooper Morris Ward
Moore Clark Baker Harrison Patel Allen Mitchell James Scott Phillips Watson Davis Parker Bennett
Griffiths Kelly Simpson Collins Shaw Carter Bailey Khan Hussain Ahmed Begum Ali Singh Kaur Shah
Murphy Ryan O'Brien O'Connor Campbell Stewart MacDonald Murray Reid Fraser Robertson Hamilton Graham
Ferguson Henderson Owen Rees Morgan Pritchard Llewellyn Bowen Okafor Adeyemi Mensah Nowak Kowalski
Chapman Ellis Marshall Saunders Palmer Holmes Barnes Fletcher Atkinson Hartley Sutcliffe Ramsden
Ackroyd Whitehead Pearson Dixon Barker Holloway Pickering Thornton Bradshaw Ashworth Haworth
Taylor-Jones Smith-Evans
`
  .trim()
  .split(/\s+/);
