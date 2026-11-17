// Restaurant details shown on the public menu.
export const restaurant = {
  name: "Donburi Ramen Bar",
  address: "Calle Príncipe, 1, Gijón",
  /** Phone number as dialed, including country code. */
  phone: "984 04 93 50",
  instagramHandle: "donburi_ramen_bar",
};

/** Digits only, as required by tel: and wa.me links. */
const phoneDigits = restaurant.phone.replace(/\D/g, "");

export const links = {
  phone: `tel:+${phoneDigits}`,
  whatsapp: `https://wa.me/${phoneDigits}`,
  instagram: `https://www.instagram.com/${restaurant.instagramHandle}/`,
};
