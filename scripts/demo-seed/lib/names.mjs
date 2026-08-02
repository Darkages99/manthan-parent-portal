export const MALE_FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan",
  "Krishna", "Ishaan", "Rohan", "Kabir", "Aryan", "Dhruv", "Karthik",
  "Siddharth", "Rahul", "Rajesh", "Manish", "Sanjay", "Vikram", "Anil",
  "Suresh", "Ramesh", "Gopal", "Harish", "Naveen", "Pranav", "Yash", "Om",
  "Devansh", "Advait", "Shaurya", "Vedant", "Arnav", "Kiaan", "Atharv",
  "Neel", "Aarush", "Nikhil", "Varun", "Abhishek", "Amit", "Deepak",
  "Gaurav", "Harsh", "Kunal", "Mohit", "Nitin", "Pradeep", "Rakesh",
  "Sameer", "Tarun", "Uday", "Vinay", "Yuvraj", "Zubin", "Ashwin",
];

export const FEMALE_FIRST_NAMES = [
  "Aanya", "Diya", "Saanvi", "Ananya", "Aadhya", "Pari", "Myra", "Sara",
  "Ira", "Anika", "Kiara", "Riya", "Ishita", "Aditi", "Priya", "Neha",
  "Pooja", "Kavita", "Sneha", "Meera", "Anjali", "Divya", "Shreya",
  "Nisha", "Swati", "Rekha", "Sunita", "Lakshmi", "Deepa", "Radha",
  "Gauri", "Tanvi", "Navya", "Avni", "Siya", "Prisha", "Kavya", "Anvi",
  "Vanya", "Trisha", "Bhavya", "Charvi", "Esha", "Falguni", "Harini",
  "Jhanvi", "Kritika", "Lavanya", "Mahika", "Nandini", "Ovi", "Pihu",
  "Rhea", "Sanya", "Tara", "Urvi", "Vidya", "Yamini", "Zara",
];

export const SURNAMES = [
  "Sharma", "Verma", "Gupta", "Iyer", "Nair", "Menon", "Reddy", "Rao",
  "Naidu", "Pillai", "Krishnan", "Subramaniam", "Joshi", "Patel", "Shah",
  "Mehta", "Desai", "Kulkarni", "Deshmukh", "Pawar", "Bhatt", "Trivedi",
  "Chatterjee", "Banerjee", "Mukherjee", "Das", "Sen", "Bose", "Roy",
  "Ghosh", "Kapoor", "Malhotra", "Khanna", "Chopra", "Bhalla", "Aggarwal",
  "Singhania", "Jain", "Agarwal", "Bansal", "Mishra", "Pandey", "Tiwari",
  "Yadav", "Chauhan", "Rathore", "Choudhary", "Bhat", "Hegde", "Shetty",
  "D'Souza", "Fernandes", "Pinto", "Rodrigues", "Kaur", "Singh", "Grewal",
  "Bedi", "Sethi", "Arora",
];

export function fullName(rng, gender) {
  const first = rng.pick(gender === "female" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES);
  const last = rng.pick(SURNAMES);
  return { first, last };
}

const usedEmails = new Set();
export function makeEmail(first, last) {
  const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
  let email = `${base}@gmail.com`;
  let n = 1;
  while (usedEmails.has(email)) {
    email = `${base}${n}@gmail.com`;
    n += 1;
  }
  usedEmails.add(email);
  return email;
}

export function makePhone(rng) {
  const first = rng.pick(["6", "7", "8", "9"]);
  let rest = "";
  for (let i = 0; i < 9; i += 1) rest += rng.int(0, 9);
  return `+91 ${first}${rest.slice(0, 4)} ${rest.slice(4, 9)}`;
}
