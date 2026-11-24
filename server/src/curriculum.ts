// The whole curriculum lives here. Edit it, then run `npm run db:seed` again:
// lessons are matched by slug, so student progress is kept.
//
// kind:      code     -> passes when the program's output equals expectedOutput
//            quiz     -> graded on the server
//            capstone -> student submits, teacher approves
// language:  blocks | javascript | python | html
//            For html lessons, expectedOutput is a list of CSS selectors (one per
//            line) that must all exist in the student's page.

export type Belt = { slug: string; name: string; color: string; rank: number; focus: string; description: string };
export type Track = { slug: string; name: string; description: string; minBeltRank: number; position: number };
export type QuizQuestion = { question: string; options: string[]; answer: number };
export type Lesson = {
  slug: string;
  track: string;
  belt?: string; // core track only
  title: string;
  kind: "code" | "quiz" | "capstone";
  language?: "blocks" | "javascript" | "python" | "html";
  instructions: string;
  starterCode?: string;
  expectedOutput?: string;
  hints?: string[];
  quiz?: QuizQuestion[];
  xp?: number;
};

export const belts: Belt[] = [
  { slug: "white", name: "White Belt", color: "#f8fafc", rank: 1, focus: "Blocks", description: "Your first programs: give the computer step-by-step instructions." },
  { slug: "yellow", name: "Yellow Belt", color: "#facc15", rank: 2, focus: "Blocks", description: "Loops and decisions: make programs repeat and choose." },
  { slug: "orange", name: "Orange Belt", color: "#fb923c", rank: 3, focus: "Blocks → JavaScript", description: "Build with blocks and see the real JavaScript they become." },
  { slug: "green", name: "Green Belt", color: "#22c55e", rank: 4, focus: "JavaScript", description: "Type real code: values, variables and strings." },
  { slug: "blue", name: "Blue Belt", color: "#3b82f6", rank: 5, focus: "JavaScript", description: "Loops, arrays and your own functions." },
  { slug: "purple", name: "Purple Belt", color: "#a855f7", rank: 6, focus: "JavaScript", description: "Objects and problem solving with algorithms." },
  { slug: "brown", name: "Brown Belt", color: "#92400e", rank: 7, focus: "Python", description: "A second language: Python basics." },
  { slug: "red", name: "Red Belt", color: "#dc2626", rank: 8, focus: "Python", description: "Lists, dictionaries and functions in Python." },
  { slug: "black", name: "Black Belt", color: "#111827", rank: 9, focus: "Capstone", description: "Design and build your own project." },
];

export const tracks: Track[] = [
  { slug: "core", name: "Belt Path", description: "The main path from White Belt to Black Belt.", minBeltRank: 0, position: 0 },
  { slug: "ai", name: "AI Literacy", description: "How AI works, what it gets wrong, and how to use it well.", minBeltRank: 2, position: 1 },
  { slug: "cyber", name: "Cybersecurity", description: "Passwords, phishing, and how codes keep secrets.", minBeltRank: 3, position: 2 },
  { slug: "web", name: "Web Development", description: "Build web pages with HTML and CSS.", minBeltRank: 4, position: 3 },
];

export const lessons: Lesson[] = [
  // ───────────── White: sequences & variables (blocks) ─────────────
  {
    slug: "white-1-hello", track: "core", belt: "white", title: "Hello, Coder!", kind: "code", language: "blocks",
    instructions: "Programs run from top to bottom.\n\nDrag a **print** block from the *Text* category, put a text block inside it, and make your program print:\n\n`Hello, Coder!`\n\nPress **Run** to test it.",
    expectedOutput: "Hello, Coder!",
    hints: ["The print block is in the Text category.", "Check your spelling, capital letters and the ! at the end."],
  },
  {
    slug: "white-2-sequence", track: "core", belt: "white", title: "Step by Step", kind: "code", language: "blocks",
    instructions: "Stack three print blocks so your program prints these lines **in this order**:\n\n```\nWake up\nBrush teeth\nCode!\n```",
    expectedOutput: "Wake up\nBrush teeth\nCode!",
    hints: ["Snap the blocks together so they touch.", "Order matters: the top block runs first."],
  },
  {
    slug: "white-3-variables", track: "core", belt: "white", title: "Boxes Called Variables", kind: "code", language: "blocks",
    instructions: "A **variable** is a labelled box that holds a value.\n\n1. Create a variable called `score`.\n2. Set `score` to `10`.\n3. Change `score` by `5`.\n4. Print `score`.\n\nYour program should print `15`.",
    expectedOutput: "15",
    hints: ["Click 'Create variable…' in the Variables category.", "'change score by 5' adds 5 to what is already in the box."],
  },

  // ───────────── Yellow: loops & conditionals (blocks) ─────────────
  {
    slug: "yellow-1-repeat", track: "core", belt: "yellow", title: "Repeat After Me", kind: "code", language: "blocks",
    instructions: "Loops repeat blocks so you don't have to copy them.\n\nUse a **repeat** block to print `Ninja!` exactly **4 times**.",
    expectedOutput: "Ninja!\nNinja!\nNinja!\nNinja!",
    hints: ["The repeat block is in the Loops category.", "Put the print block *inside* the repeat block."],
  },
  {
    slug: "yellow-2-count", track: "core", belt: "yellow", title: "Count It Up", kind: "code", language: "blocks",
    instructions: "Use a **count with i from 1 to 5** loop to print the numbers 1 to 5, one per line.",
    expectedOutput: "1\n2\n3\n4\n5",
    hints: ["Look for 'count with i from 1 to 10 by 1' in Loops.", "Print the variable i inside the loop."],
  },
  {
    slug: "yellow-3-if", track: "core", belt: "yellow", title: "Make a Choice", kind: "code", language: "blocks",
    instructions: "Set a variable `age` to `12`.\n\nUse an **if / else** block: if `age` is greater than or equal to `13`, print `Teen`, otherwise print `Kid`.\n\nWith age 12 your program should print `Kid`.",
    expectedOutput: "Kid",
    hints: ["Click the gear on the 'if' block to add an 'else'.", "The comparison block (≥) is in the Logic category."],
  },

  // ───────────── Orange: functions, blocks → JS ─────────────
  {
    slug: "orange-1-functions", track: "core", belt: "orange", title: "Your Own Block", kind: "code", language: "blocks",
    instructions: "A **function** is a block you make yourself.\n\nMake a function called `cheer` that prints `Go team!`. Then call `cheer` **twice**.\n\nWatch the **JavaScript** panel: that's the real code your blocks turn into.",
    expectedOutput: "Go team!\nGo team!",
    hints: ["Functions are in the Functions category: 'to do something'.", "After you create it, a 'cheer' call block appears in Functions."],
  },
  {
    slug: "orange-2-fizz", track: "core", belt: "orange", title: "Even or Odd", kind: "code", language: "blocks",
    instructions: "Count from 1 to 6. For each number, print `even` if it divides by 2, otherwise print `odd`.\n\nTip: Math has a block 'is even'.",
    expectedOutput: "odd\neven\nodd\neven\nodd\neven",
    hints: ["Put an if/else inside a count loop.", "The 'is even' block is in the Math category."],
  },
  {
    slug: "orange-3-read-js", track: "core", belt: "orange", title: "Read the Code", kind: "quiz",
    instructions: "Look at this JavaScript and answer the questions.\n\n```js\nlet total = 0;\nfor (let i = 1; i <= 3; i++) {\n  total = total + i;\n}\nconsole.log(total);\n```",
    quiz: [
      { question: "What does console.log do?", options: ["Deletes a value", "Shows a value in the output", "Makes a loop"], answer: 1 },
      { question: "How many times does the loop run?", options: ["1", "3", "4"], answer: 1 },
      { question: "What does the program print?", options: ["3", "6", "123"], answer: 1 },
    ],
  },

  // ───────────── Green: JavaScript basics ─────────────
  {
    slug: "green-1-console", track: "core", belt: "green", title: "Typing Real Code", kind: "code", language: "javascript",
    instructions: "Now you type the code yourself.\n\n`console.log(...)` prints to the output. Make the program print:\n\n```\nI can code!\n2026\n```",
    starterCode: "// Print text in quotes, numbers without quotes\nconsole.log(\"I can code!\");\n",
    expectedOutput: "I can code!\n2026",
    hints: ["Add a second line: console.log(2026);"],
  },
  {
    slug: "green-2-variables", track: "core", belt: "green", title: "let and const", kind: "code", language: "javascript",
    instructions: "Create a `const` called `price` with value `4`, and a `let` called `count` with value `3`.\n\nPrint `price * count`. The output should be `12`.",
    starterCode: "const price = 4;\n// make count here\n\n",
    expectedOutput: "12",
    hints: ["let count = 3;", "console.log(price * count);"],
  },
  {
    slug: "green-3-strings", track: "core", belt: "green", title: "Mixing Text", kind: "code", language: "javascript",
    instructions: "Template strings use backticks and `${}` to put values inside text.\n\nUsing the variables given, print exactly:\n\n`Ada has 3 badges`",
    starterCode: "const name = \"Ada\";\nconst badges = 3;\n\nconsole.log(`...`);\n",
    expectedOutput: "Ada has 3 badges",
    hints: ["`${name} has ${badges} badges`"],
  },

  // ───────────── Blue: loops, arrays, functions (JS) ─────────────
  {
    slug: "blue-1-for", track: "core", belt: "blue", title: "For Loops", kind: "code", language: "javascript",
    instructions: "Write a `for` loop that prints the even numbers from 2 to 10, one per line.",
    starterCode: "for (let i = 2; i <= 10; i += 2) {\n  // print i\n}\n",
    expectedOutput: "2\n4\n6\n8\n10",
    hints: ["Inside the loop: console.log(i);"],
  },
  {
    slug: "blue-2-arrays", track: "core", belt: "blue", title: "Arrays", kind: "code", language: "javascript",
    instructions: "An **array** is a list. Add `\"kiwi\"` to the end of `fruits` with `.push()`, then print how many fruits there are and the last one:\n\n```\n4\nkiwi\n```",
    starterCode: "const fruits = [\"apple\", \"banana\", \"mango\"];\n\n",
    expectedOutput: "4\nkiwi",
    hints: ["fruits.length tells you how many items.", "The last item is fruits[fruits.length - 1]."],
  },
  {
    slug: "blue-3-functions", track: "core", belt: "blue", title: "Functions That Return", kind: "code", language: "javascript",
    instructions: "Write a function `double(n)` that **returns** `n * 2`. The code below prints its results; don't change it.",
    starterCode: "function double(n) {\n  // return something\n}\n\nconsole.log(double(4));\nconsole.log(double(21));\n",
    expectedOutput: "8\n42",
    hints: ["return n * 2;"],
  },

  // ───────────── Purple: objects & algorithms (JS) ─────────────
  {
    slug: "purple-1-objects", track: "core", belt: "purple", title: "Objects", kind: "code", language: "javascript",
    instructions: "Objects group related values. Give `hero` a `level` of `5`, then print:\n\n`Kai is level 5`",
    starterCode: "const hero = { name: \"Kai\" };\n\n",
    expectedOutput: "Kai is level 5",
    hints: ["hero.level = 5;", "console.log(`${hero.name} is level ${hero.level}`);"],
  },
  {
    slug: "purple-2-max", track: "core", belt: "purple", title: "Find the Biggest", kind: "code", language: "javascript",
    instructions: "Without using `Math.max`, write a loop that finds the largest number in `scores` and prints it.",
    starterCode: "const scores = [42, 17, 88, 63, 9];\nlet best = scores[0];\n\n// loop here\n\nconsole.log(best);\n",
    expectedOutput: "88",
    hints: ["for (const s of scores) { ... }", "If s is bigger than best, set best = s."],
  },
  {
    slug: "purple-3-fizzbuzz", track: "core", belt: "purple", title: "FizzBuzz", kind: "code", language: "javascript",
    instructions: "Print the numbers 1 to 15. But for multiples of 3 print `Fizz`, for multiples of 5 print `Buzz`, and for multiples of both print `FizzBuzz`.",
    starterCode: "for (let i = 1; i <= 15; i++) {\n\n}\n",
    expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz",
    hints: ["i % 3 === 0 means i divides by 3.", "Check for 'both' first."],
    xp: 20,
  },

  // ───────────── Brown: Python basics ─────────────
  {
    slug: "brown-1-print", track: "core", belt: "brown", title: "Hello, Python", kind: "code", language: "python",
    instructions: "Python uses `print()` and doesn't need semicolons. Print:\n\n```\nHello, Python\n7\n```\n\n(The first run may take a few seconds while Python loads.)",
    starterCode: "print(\"Hello, Python\")\n",
    expectedOutput: "Hello, Python\n7",
    hints: ["print(3 + 4)"],
  },
  {
    slug: "brown-2-input-free-math", track: "core", belt: "brown", title: "Variables and f-strings", kind: "code", language: "python",
    instructions: "Python's f-strings work like JavaScript template strings. Print:\n\n`Sam scored 90 points`",
    starterCode: "name = \"Sam\"\npoints = 90\n\n",
    expectedOutput: "Sam scored 90 points",
    hints: ["print(f\"{name} scored {points} points\")"],
  },
  {
    slug: "brown-3-loops", track: "core", belt: "brown", title: "Indentation and Loops", kind: "code", language: "python",
    instructions: "In Python, the **indent** shows what's inside a loop. Use `for i in range(...)` to print 3, 2, 1, then `Liftoff!`.",
    starterCode: "for i in range(3, 0, -1):\n    pass  # replace with print\n\n",
    expectedOutput: "3\n2\n1\nLiftoff!",
    hints: ["print(i) inside the loop (indented).", "print(\"Liftoff!\") after the loop (not indented)."],
  },

  // ───────────── Red: Python data structures ─────────────
  {
    slug: "red-1-lists", track: "core", belt: "red", title: "Lists", kind: "code", language: "python",
    instructions: "Add `\"dragon\"` to `pets` with `.append()`, then print the list's length and the pets sorted alphabetically:\n\n```\n4\n['cat', 'dog', 'dragon', 'fish']\n```",
    starterCode: "pets = [\"dog\", \"cat\", \"fish\"]\n\n",
    expectedOutput: "4\n['cat', 'dog', 'dragon', 'fish']",
    hints: ["len(pets)", "sorted(pets)"],
  },
  {
    slug: "red-2-dicts", track: "core", belt: "red", title: "Dictionaries", kind: "code", language: "python",
    instructions: "A dictionary maps keys to values. Loop over `stock` and print each item like `apples: 5`.",
    starterCode: "stock = {\"apples\": 5, \"pears\": 2, \"plums\": 8}\n\n",
    expectedOutput: "apples: 5\npears: 2\nplums: 8",
    hints: ["for item, count in stock.items():"],
  },
  {
    slug: "red-3-functions", track: "core", belt: "red", title: "Python Functions", kind: "code", language: "python",
    instructions: "Write `average(nums)` that returns the average of a list. Don't change the print lines.",
    starterCode: "def average(nums):\n    pass\n\nprint(average([2, 4, 6]))\nprint(average([10, 5]))\n",
    expectedOutput: "4.0\n7.5",
    hints: ["sum(nums) / len(nums)"],
    xp: 20,
  },

  // ───────────── Black: capstone ─────────────
  {
    slug: "black-1-plan", track: "core", belt: "black", title: "Plan Your Project", kind: "quiz",
    instructions: "Before you build, plan. Good projects start small and grow.",
    quiz: [
      { question: "What should you build first?", options: ["Every feature at once", "The smallest version that works", "The logo"], answer: 1 },
      { question: "Your code has a bug. What's the best first step?", options: ["Delete everything", "Read the error and test one small piece", "Ask a friend to rewrite it"], answer: 1 },
    ],
  },
  {
    slug: "black-2-capstone", track: "core", belt: "black", title: "Capstone Project", kind: "capstone", language: "javascript",
    instructions: "Build your own program in JavaScript. Ideas: a quiz game, a number-guessing game against the computer, a text adventure, or a grade calculator.\n\nYour project must use **variables, a loop, a condition, a function and an array or object**.\n\nWhen you're proud of it, press **Submit for review**. Your teacher will approve it or send feedback.",
    starterCode: "// My capstone project\n// Name:\n// What it does:\n\n",
    xp: 100,
  },

  // ───────────── AI Literacy ─────────────
  {
    slug: "ai-1-what-is-ai", track: "ai", title: "What Is AI?", kind: "quiz",
    instructions: "AI systems learn **patterns from examples** (data) instead of following only hand-written rules. A spam filter learns from thousands of emails labelled spam or not spam.",
    quiz: [
      { question: "How does a machine-learning model learn?", options: ["From examples (data)", "It already knows everything", "By reading your mind"], answer: 0 },
      { question: "A chatbot gives a confident answer. What should you do?", options: ["Trust it, computers are always right", "Check important facts with another source", "Never use it"], answer: 1 },
      { question: "If a model only sees photos of orange cats, it might…", options: ["Recognise all cats perfectly", "Struggle with black cats", "Learn to bark"], answer: 1 },
    ],
  },
  {
    slug: "ai-2-rules-vs-learning", track: "ai", title: "Write a Tiny Classifier", kind: "code", language: "python",
    instructions: "Before machine learning, people wrote rules by hand. Finish `classify` so that animals with `legs == 0` are `fish`, `legs == 2` are `bird`, and anything else is `mammal`.",
    starterCode: "def classify(legs):\n    pass\n\nfor legs in [0, 2, 4]:\n    print(classify(legs))\n",
    expectedOutput: "fish\nbird\nmammal",
    hints: ["Use if / elif / else and return a string."],
  },
  {
    slug: "ai-3-bias", track: "ai", title: "Fairness and Bias", kind: "quiz",
    instructions: "AI learns from data made by people, so it can copy people's mistakes and unfairness. This is called **bias**.",
    quiz: [
      { question: "Where does bias in AI usually come from?", options: ["The data it learned from", "The colour of the computer", "The internet speed"], answer: 0 },
      { question: "Which is a responsible use of AI for homework?", options: ["Copy its essay and hand it in", "Use it to explain an idea, then write in your own words", "Ask it for your friend's password"], answer: 1 },
    ],
  },

  // ───────────── Cybersecurity ─────────────
  {
    slug: "cyber-1-passwords", track: "cyber", title: "Strong Passwords", kind: "quiz",
    instructions: "Long passwords beat clever ones. A passphrase like `purple-otter-drinks-tea` is easy to remember and hard to guess.",
    quiz: [
      { question: "Which password is strongest?", options: ["Password1", "purple-otter-drinks-tea", "qwerty"], answer: 1 },
      { question: "Is it OK to use the same password everywhere?", options: ["Yes, it's easier", "No, one leak unlocks everything"], answer: 1 },
      { question: "A friend asks for your password. You should…", options: ["Share it, they're a friend", "Keep it private"], answer: 1 },
    ],
  },
  {
    slug: "cyber-2-phishing", track: "cyber", title: "Spot the Phish", kind: "quiz",
    instructions: "**Phishing** messages pretend to be someone you trust to steal your login. Warning signs: urgency, odd links, spelling mistakes, requests for passwords.",
    quiz: [
      { question: "\"Your account closes in 1 hour! Log in at sch00l-login.biz\" is probably…", options: ["Real", "Phishing"], answer: 1 },
      { question: "What should you do with a suspicious link?", options: ["Click to check", "Don't click; tell a teacher or adult"], answer: 1 },
    ],
  },
  {
    slug: "cyber-3-caesar", track: "cyber", title: "Caesar Cipher", kind: "code", language: "javascript",
    instructions: "A Caesar cipher shifts each letter along the alphabet. Shift 3: `A → D`, `B → E`.\n\nFinish `encode` so it shifts uppercase letters by `shift`, wrapping `Z` back to `A`. Leave spaces alone.",
    starterCode: "function encode(text, shift) {\n  let out = \"\";\n  for (const ch of text) {\n    if (ch === \" \") { out += ch; continue; }\n    const code = ch.charCodeAt(0) - 65; // A = 0\n    // shift, wrap with % 26, convert back with String.fromCharCode(... + 65)\n  }\n  return out;\n}\n\nconsole.log(encode(\"HELLO\", 3));\nconsole.log(encode(\"XYZ ABC\", 3));\n",
    expectedOutput: "KHOOR\nABC DEF",
    hints: ["(code + shift) % 26", "out += String.fromCharCode(((code + shift) % 26) + 65);"],
    xp: 20,
  },

  // ───────────── Web Development ─────────────
  {
    slug: "web-1-first-page", track: "web", title: "Your First Web Page", kind: "code", language: "html",
    instructions: "HTML uses **tags** to describe a page. Add:\n\n- an `<h1>` heading with your name\n- a `<p>` paragraph about something you like\n\nThe preview updates as you type. Press **Run** to check.",
    starterCode: "<!-- Write your page here -->\n<h1></h1>\n",
    expectedOutput: "h1\np",
    hints: ["<p>I like robots.</p>"],
  },
  {
    slug: "web-2-lists-links", track: "web", title: "Lists and Links", kind: "code", language: "html",
    instructions: "Make an unordered list (`<ul>`) with **at least 3** items (`<li>`) of favourite games, and an `<a>` link with an `href`.",
    starterCode: "<h2>My favourite games</h2>\n\n",
    expectedOutput: "ul li:nth-child(3)\na[href]",
    hints: ["<ul>\n  <li>Chess</li>\n  ...\n</ul>", "<a href=\"https://example.com\">a link</a>"],
  },
  {
    slug: "web-3-css", track: "web", title: "Style With CSS", kind: "code", language: "html",
    instructions: "CSS changes how a page looks. Add a `<style>` tag, and give a `<div>` the class `card`. Style `.card` with a background colour and padding.",
    starterCode: "<style>\n  .card {\n\n  }\n</style>\n\n<div>\n  <h2>About me</h2>\n</div>\n",
    expectedOutput: "style\ndiv.card",
    hints: ["<div class=\"card\">", "background: lightyellow; padding: 16px;"],
  },
];
