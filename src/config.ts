// Restaurant details shown on the public menu.
// TODO: replace the placeholders with the real Donburi Ramen Bar details.
export const restaurant = {
  name: "Donburi Ramen Bar",
  address: "Calle Ejemplo 123, 28000 Madrid",
  /** Phone number as dialed, including country code. */
  phone: "+34 600 000 000",
  instagramHandle: "donburiramenbar",
};

/** Digits only, as required by tel: and wa.me links. */
const phoneDigits = restaurant.phone.replace(/\D/g, "");

export const links = {
  phone: `tel:+${phoneDigits}`,
  whatsapp: `https://wa.me/${phoneDigits}`,
  instagram: `https://www.instagram.com/${restaurant.instagramHandle}/`,
};
