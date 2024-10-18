let countries = [];

function loadKml(url) {
  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.text();
    })
    .then((kmlText) => {
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlText, "application/xml");
      const coordinates = Array.from(
        kmlDoc.getElementsByTagName("coordinates")
      ).map((coord) =>
        coord.textContent
          .trim()
          .split(" ")
          .map((pair) => {
            const [lng, lat] = pair.split(",").map(Number);
            return { lat, lng };
          })
      );
      return coordinates;
    });
}

fetch("countries.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    return response.json();
  })
  .then((data) => {
    countries = data;

    const savedIndex = localStorage.getItem("currentIndex");
    currentIndex = savedIndex ? parseInt(savedIndex, 10) : 0;

    updateCountryInfo(); 
  })
  .catch((error) => {
    console.error("There has been a problem with your fetch operation:", error);
  });

let currentIndex = 0;
let map;

function updateCountryInfo() {
  const country = countries[currentIndex];
  document.getElementById("country-name").textContent = country.name;
  document.getElementById("country-description").textContent =
    country.description;
  document.querySelector(".left").style.backgroundImage =
    country.backgroundImage;

  const kmlFileMap = {
    Washington: "washington.kml",
    Virginia: "virginia.kml",
    "New Jersey": "newjersey.kml",
    "New York": "newyork.kml",
  };

  const kmlFile = kmlFileMap[country.name];
  loadKml(kmlFile)
    .then((kmlCoordinates) => {
      country.countryBounds = kmlCoordinates;
      initMap(country.coordinates, country.cafes, country.countryBounds);
    })
    .catch((error) => {
      console.error("Error loading KML file:", error);
    });

  document.getElementById("current-country").textContent = country.name;
  document.getElementById("next-country-1").textContent =
    countries[(currentIndex + 1) % countries.length].name;
  document.getElementById("next-country-2").textContent =
    countries[(currentIndex + 2) % countries.length].name;

  const cityMenu = document.getElementById("city-menu");
  cityMenu.innerHTML = ""; 
  countries.forEach((country, index) => {
    const option = document.createElement("div");
    option.classList.add("city-option");
    option.textContent = country.name;
    option.onclick = () => {
      currentIndex = index; 
      localStorage.setItem("currentIndex", currentIndex); 
      updateCountryInfo();
      document.getElementById("city-menu").classList.add("hidden");
    };
    cityMenu.appendChild(option);
  });
}

function initMap(center, cafes, countryBounds) {
  if (map) {
    map = null;
  }

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 5,
    center: center,
  });

  const countryPolygon = new google.maps.Polygon({
    paths: countryBounds,
    strokeColor: "darkpink",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "lightpink",
    fillOpacity: 0.6,
  });
  countryPolygon.setMap(map);

  cafes.forEach((cafe) => {
    const marker = new google.maps.Marker({
      position: cafe.coordinates,
      map: map,
      title: cafe.name,
    });

    const infowindow = new google.maps.InfoWindow({
      content: cafe.name,
    });

    marker.addListener("click", () => {
      infowindow.open(map, marker);
    });
  });

  const bounds = new google.maps.LatLngBounds();
  countryBounds.forEach((coord) => bounds.extend(coord));
  cafes.forEach((cafe) => bounds.extend(cafe.coordinates));
  map.fitBounds(bounds);
}

document.querySelector(".arrow-left").addEventListener("click", () => {
  currentIndex = (currentIndex - 1 + countries.length) % countries.length;
  localStorage.setItem("currentIndex", currentIndex); 
  updateCountryInfo();
});

document.querySelector(".arrow-right").addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % countries.length;
  localStorage.setItem("currentIndex", currentIndex);
  updateCountryInfo();
});

document.getElementById("toggler").addEventListener("click", () => {
  const cityMenu = document.getElementById("city-menu");
  cityMenu.classList.toggle("hidden"); 
  document.getElementById("country-info").classList.toggle("hidden"); 
});

updateCountryInfo();
