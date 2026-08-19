const consultationValue = 'Уточняется при консультации';
const defaultPreview = { fit: 'contain', position: '50% 50%' };

function image(src, alt, width, height) {
  return { src, alt, width, height, ...defaultPreview };
}

export const icons = [
  {
    slug: 'archangel-michael',
    title: 'Архистратиг Михаил',
    type: 'Авторские',
    period: 'Современные',
    availability: 'В наличии',
    price: 'По запросу',
    size: consultationValue,
    technique: consultationValue,
    origin: consultationValue,
    condition: consultationValue,
    expertise: consultationValue,
    description: consultationValue,
    images: [image('/assets/icons/archangel-michael.jpg', 'Архистратиг Михаил, полный вид', 2342, 2685)],
    previewFit: 'contain',
    previewPosition: '50% 50%'
  },
  {
    slug: 'resurrection',
    title: 'Храмовая икона «Воскресение Христово»',
    type: 'Храмовые',
    period: 'Современные',
    availability: 'В наличии',
    price: 'По запросу',
    size: consultationValue,
    technique: consultationValue,
    origin: consultationValue,
    condition: consultationValue,
    expertise: consultationValue,
    description: consultationValue,
    images: [image('/assets/icons/resurrection.jpg', 'Храмовая икона «Воскресение Христово», полный вид', 1900, 2946)],
    previewFit: 'contain',
    previewPosition: '50% 50%'
  },
  {
    slug: 'alexander-peresvet',
    title: 'Преподобный Александр Пересвет',
    type: 'Авторские',
    period: 'Современные',
    availability: 'В наличии',
    price: '100 000 руб.',
    size: '60 × 30 см',
    technique: 'Доска без ковчега, две врезные шпонки, меловой левкас, яичная минеральная темпера, сусальное и творёное золото',
    origin: 'Авторская работа мастерской, один экземпляр',
    condition: consultationValue,
    expertise: consultationValue,
    description: consultationValue,
    images: [image('/assets/icons/alexander-peresvet.jpg', 'Преподобный Александр Пересвет, полный вид', 242, 500)],
    previewFit: 'contain',
    previewPosition: '50% 50%'
  },
  {
    slug: 'facade-george',
    title: 'Фасадная икона «Чудо Георгия о змие»',
    type: 'Фасадные',
    period: 'Современные',
    availability: 'По запросу',
    price: 'По запросу',
    size: consultationValue,
    technique: consultationValue,
    origin: consultationValue,
    condition: consultationValue,
    expertise: consultationValue,
    description: consultationValue,
    images: [
      image('/assets/icons/facade-george.jpg', 'Фасадная икона «Чудо Георгия о змие», полный вид', 629, 817),
      image('/assets/icons/facade-george-2.jpg', 'Фасадная икона «Чудо Георгия о змие», дополнительный вид 1', 678, 1057),
      image('/assets/icons/facade-george-3.jpg', 'Фасадная икона «Чудо Георгия о змие», дополнительный вид 2', 1900, 2850),
      image('/assets/icons/facade-george-4.jpg', 'Фасадная икона «Чудо Георгия о змие», дополнительный вид 3', 592, 888),
      image('/assets/icons/facade-george-5.jpg', 'Фасадная икона «Чудо Георгия о змие», дополнительный вид 4', 1900, 3341)
    ],
    previewFit: 'contain',
    previewPosition: '50% 50%'
  },
  {
    slug: 'sretenie',
    title: 'Сретение Христово',
    type: 'Праздничные',
    period: 'Современные',
    availability: 'В наличии',
    price: 'По запросу',
    size: consultationValue,
    technique: consultationValue,
    origin: consultationValue,
    condition: consultationValue,
    expertise: consultationValue,
    description: consultationValue,
    images: [image('/assets/icons/sretenie.jpg', 'Сретение Христово, полный вид', 495, 665)],
    previewFit: 'contain',
    previewPosition: '50% 50%'
  },
  {
    slug: 'sergius-appearance',
    title: 'Явление Богородицы преподобному Сергию Радонежскому',
    type: 'Старинные',
    period: 'XVIII–XIX век',
    availability: 'В наличии',
    price: '200 000 руб.',
    size: '31 × 23 см; киот 45 × 29 см',
    technique: 'Доска, левкас, яичная темпера',
    origin: 'Мастерская Троице-Сергиевой лавры, рубеж XVIII–XIX век',
    condition: consultationValue,
    expertise: consultationValue,
    description: consultationValue,
    images: [
      image('/assets/icons/sergius-appearance.jpg', 'Явление Богородицы преподобному Сергию Радонежскому, полный вид', 715, 955),
      image('/assets/icons/sergius-appearance-2.jpg', 'Явление Богородицы преподобному Сергию Радонежскому, дополнительный вид', 2442, 2935)
    ],
    previewFit: 'contain',
    previewPosition: '50% 50%'
  }
];
