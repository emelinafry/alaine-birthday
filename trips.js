// Every trip and memory, from earliest to latest.
// Add a new object to this list for each chapter. The girls grow a little
// with every chapter you scroll past.
//
//   age   - how old they were (shown as a small label)
//   title - name of the trip or memory
//   place - where it happened
//   when  - date or year, any format
//   text  - the story, as long or short as you like
//   sky   - background colour for this chapter (any CSS colour)
//   photo - optional path to an image, for example "photos/beach.jpg"
//   scene - optional landmark drawn behind the girls: "dc"
//   hat   - optional thing the girls wear in this chapter: "beret"
//   fly   - optional 3D view opened from a button on the card: "dc" (aerial DC from map data)

window.TRIPS = [
  {
    age: "little",
    title: "Two little French girls in Washington, DC",
    place: "Washington, DC",
    when: "Year",
    text: "All the way from France to the capital of America: the big white dome, the tall monument, and the two of us taking in all of it.",
    sky: "#dcebff",
    scene: "dc",
    hat: "beret",
    fly: "dc",
  },
  {
    age: "?",
    title: "Trip two",
    place: "Somewhere else",
    when: "Year",
    text: "Placeholder for the second memory.",
    sky: "#e3f1ff",
  },
  {
    age: "?",
    title: "Trip three",
    place: "Another place",
    when: "Year",
    text: "Placeholder for the third memory.",
    sky: "#e8ffe3",
  },
];
