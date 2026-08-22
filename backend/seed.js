const { v4: uuid } = require('uuid');
const db = require('./db');

const cityCount = db.prepare('SELECT COUNT(*) c FROM cities').get().c;

if (cityCount === 0) {
  console.log('Seeding cities & activities...');

  const cities = [
    { name: 'Paris', country: 'France', region: 'Europe', cost_index: 150, popularity: 98 },
    { name: 'Rome', country: 'Italy', region: 'Europe', cost_index: 120, popularity: 92 },
    { name: 'Barcelona', country: 'Spain', region: 'Europe', cost_index: 110, popularity: 88 },
    { name: 'Amsterdam', country: 'Netherlands', region: 'Europe', cost_index: 130, popularity: 85 },
    { name: 'Tokyo', country: 'Japan', region: 'Asia', cost_index: 140, popularity: 95 },
    { name: 'Bangkok', country: 'Thailand', region: 'Asia', cost_index: 60, popularity: 90 },
    { name: 'Bali', country: 'Indonesia', region: 'Asia', cost_index: 55, popularity: 93 },
    { name: 'Dubai', country: 'UAE', region: 'Middle East', cost_index: 170, popularity: 87 },
    { name: 'New York', country: 'USA', region: 'North America', cost_index: 200, popularity: 96 },
    { name: 'Cancun', country: 'Mexico', region: 'North America', cost_index: 100, popularity: 80 },
    { name: 'Cape Town', country: 'South Africa', region: 'Africa', cost_index: 80, popularity: 78 },
    { name: 'Sydney', country: 'Australia', region: 'Oceania', cost_index: 160, popularity: 84 },
    { name: 'Prague', country: 'Czech Republic', region: 'Europe', cost_index: 85, popularity: 79 },
    { name: 'Istanbul', country: 'Turkey', region: 'Europe', cost_index: 70, popularity: 82 },
    { name: 'Singapore', country: 'Singapore', region: 'Asia', cost_index: 150, popularity: 86 },
  ];

  const insertCity = db.prepare(`INSERT INTO cities (id, name, country, region, cost_index, popularity, image_url)
    VALUES (@id, @name, @country, @region, @cost_index, @popularity, @image_url)`);

  const cityIds = {};
  for (const c of cities) {
    const id = uuid();
    cityIds[c.name] = id;
    insertCity.run({ ...c, id, image_url: '' });
  }

  const activityTemplates = {
    sightseeing: ['City Landmark Tour', 'Old Town Walking Tour', 'Skyline Viewpoint Visit', 'Historic Monument Visit'],
    food: ['Local Food Tasting Tour', 'Street Food Crawl', 'Fine Dining Experience', 'Cooking Class'],
    adventure: ['Day Hike & Nature Trail', 'Water Sports Session', 'Cycling City Tour', 'Adventure Park Visit'],
    culture: ['Museum & Art Gallery Visit', 'Local Market Exploration', 'Traditional Dance Show', 'Heritage Site Tour'],
    relaxation: ['Spa & Wellness Session', 'Beach Relaxation Day', 'Sunset Cruise', 'Botanical Garden Walk'],
  };

  const insertActivity = db.prepare(`INSERT INTO activities (id, city_id, name, type, cost, duration_hours, description, image_url)
    VALUES (@id, @city_id, @name, @type, @cost, @duration_hours, @description, @image_url)`);

  for (const cityName of Object.keys(cityIds)) {
    for (const [type, names] of Object.entries(activityTemplates)) {
      const name = names[Math.floor(Math.random() * names.length)];
      insertActivity.run({
        id: uuid(),
        city_id: cityIds[cityName],
        name: `${name} - ${cityName}`,
        type,
        cost: Math.round((Math.random() * 80 + 10) * 100) / 100,
        duration_hours: [1, 2, 3, 4, 6][Math.floor(Math.random() * 5)],
        description: `Enjoy a curated ${type} experience while exploring ${cityName}.`,
        image_url: '',
      });
    }
  }

  console.log('Seed complete:', cities.length, 'cities added.');
} else {
  console.log('Cities already seeded, skipping.');
}
