let countries = [];
let currentIndex = 0;
let map;
let activeInfoWindow = null;
let currentPolygon = null;
let markers = [];

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

    const urlParams = new URLSearchParams(window.location.search);
    const countryParam = urlParams.get("country");
    currentIndex = countries.findIndex(
      (country) => country.name === countryParam
    );

    if (currentIndex === -1) {
      currentIndex = 0;
    }

    updateCountryInfo();
  })
  .catch((error) => {
    console.error("There has been a problem with your fetch operation:", error);
  });

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

      clearMap();

      initMap(country.coordinates, country.cafes, country.countryBounds);
    })
    .catch((error) => {
      console.error("Error loading KML file:", error);
    });

  document.getElementById("current-country").textContent = country.name;
  document.getElementById("next-country-1").textContent =
    countries[(currentIndex - 1 + countries.length) % countries.length].name;
  document.getElementById("next-country-2").textContent =
    countries[(currentIndex + 1) % countries.length].name;

  const cityMenu = document.getElementById("city-menu");
  cityMenu.innerHTML = "";
  countries.forEach((country, index) => {
    const option = document.createElement("div");
    option.classList.add("city-option");
    option.textContent = country.name;
    option.onclick = () => {
      updateCountryWithAnimation(index);
      cityMenu.classList.add("hidden");
    };
    cityMenu.appendChild(option);
  });
}

function clearMap() {
  if (currentPolygon) {
    currentPolygon.setMap(null);
  }

  markers.forEach((marker) => marker.setMap(null));
  markers = [];
}

function smoothPanTo(target, duration) {
  const start = map.getCenter();
  const end = new google.maps.LatLng(target.lat, target.lng);
  const startTime = new Date().getTime();

  const animate = () => {
    const now = new Date().getTime();
    const elapsedTime = now - startTime;
    const time = Math.min(1, elapsedTime / duration);

    const lat = start.lat() + (end.lat() - start.lat()) * time;
    const lng = start.lng() + (end.lng() - start.lng()) * time;

    map.setCenter(new google.maps.LatLng(lat, lng));

    if (time < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}

function initMap(center, cafes, countryBounds) {
  if (!map) {
    map = new google.maps.Map(document.getElementById("map"), {
      zoom: 5,
      center: center,
    });
  } else {
    smoothPanTo(center, 1000);
  }

  currentPolygon = new google.maps.Polygon({
    paths: countryBounds,
    strokeColor: "violet",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "violet",
    fillOpacity: 0.6,
  });
  currentPolygon.setMap(map);

  const hotelIcon = {
    url: "./icons8-google-maps-48.png",
    scaledSize: new google.maps.Size(30, 30),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(15, 30),
  };

  cafes.forEach((cafe) => {
    const marker = new google.maps.Marker({
      position: cafe.coordinates,
      map: map,
      title: cafe.name,
      icon: hotelIcon,
    });

    markers.push(marker);

    const infowindow = new google.maps.InfoWindow({
      content: createInfoWindowContent(cafe),
      maxWidth: 300,
    });

    marker.addListener("mouseover", () => {
      if (activeInfoWindow) {
        activeInfoWindow.close();
      }
      infowindow.open(map, marker);
      activeInfoWindow = infowindow;
      initializeSlider(cafe.name);
    });

    marker.addListener("mouseout", () => {
      setTimeout(() => {
        if (!isMouseOverInfoWindow(infowindow)) {
          infowindow.close();
          activeInfoWindow = null;
        }
      }, 50);
    });
  });

  map.addListener("click", () => {
    if (activeInfoWindow) {
      activeInfoWindow.close();
      activeInfoWindow = null;
    }
  });

  const bounds = new google.maps.LatLngBounds();
  countryBounds.forEach((coord) => bounds.extend(coord));
  cafes.forEach((cafe) => bounds.extend(cafe.coordinates));
  map.fitBounds(bounds);

  const mapElement = document.getElementById("map");
  mapElement.classList.remove("visible");
  setTimeout(() => {
    mapElement.classList.add("visible");
  }, 0);
}

function createInfoWindowContent(cafe) {
  return `
    <div class="info-window">
      <div class="slider-container">
        <button class="slick-prev slick-arrow" aria-label="Previous" type="button">Previous</button>
        <div class="slider" id="slider-${cafe.name.replace(/\s+/g, "-")}">
          ${cafe.images
            .map((img) => `<img src="${img}" alt="${cafe.name}">`)
            .join("")}
        </div>
        <button class="slick-next slick-arrow" aria-label="Next" type="button">Next</button>
      </div>
      <h3>${cafe.name}</h3>
      <p>${cafe.description}</p>
    </div>
  `;
}

function initializeSlider(cafeName) {
  const sliderId = `#slider-${cafeName.replace(/\s+/g, "-")}`;
  $(sliderId).slick({
    dots: true,
    infinite: true,
    speed: 1000,
    fade: true,
    cssEase: "linear",
    autoplay: true,
    autoplaySpeed: 500,
    prevArrow: $(sliderId).parent().find(".slick-prev"),
    nextArrow: $(sliderId).parent().find(".slick-next"),
  });
}

function isMouseOverInfoWindow(infoWindow) {
  const infoWindowElement = document.querySelector(".gm-style-iw-c");
  if (!infoWindowElement) return false;
  const rect = infoWindowElement.getBoundingClientRect();
  const mousePosition = { x: event.clientX, y: event.clientY };
  return (
    mousePosition.x >= rect.left &&
    mousePosition.x <= rect.right &&
    mousePosition.y >= rect.top &&
    mousePosition.y <= rect.bottom
  );
}

function updateCountryWithAnimation(newIndex) {
  const leftContainer = document.querySelector(".left");
  leftContainer.classList.add("hidden");

  setTimeout(() => {
    currentIndex = newIndex;
    updateUrlParameter("country", countries[currentIndex].name);
    updateCountryInfo();
    leftContainer.classList.remove("hidden");
  }, 500);
}
function updateUrlParameter(param, value) {
  const url = new URL(window.location);
  url.searchParams.set(param, value);
  window.history.pushState({}, "", url);
}

document.querySelector(".arrow-left").addEventListener("click", () => {
  updateCountryWithAnimation(
    (currentIndex - 1 + countries.length) % countries.length
  );
});

document.querySelector(".arrow-right").addEventListener("click", () => {
  updateCountryWithAnimation((currentIndex + 1) % countries.length);
});

document.getElementById("next-country-1").onclick = () => {
  const newIndex = (currentIndex - 1 + countries.length) % countries.length;
  updateCountryWithAnimation(newIndex);
};

document.getElementById("next-country-2").onclick = () => {
  const newIndex = (currentIndex + 1) % countries.length;
  updateCountryWithAnimation(newIndex);
};

document.getElementById("toggler").addEventListener("click", () => {
  const cityMenu = document.getElementById("city-menu");
  const countryInfo = document.getElementById("country-info");

  if (!cityMenu.classList.contains("visible")) {
    cityMenu.classList.add("visible");
    countryInfo.classList.add("hidden");
    cityMenu.style.display = "flex";
  } else {
    cityMenu.classList.remove("visible");
    countryInfo.classList.remove("hidden");

    setTimeout(() => {
      cityMenu.style.display = "none";
    }, 500);
  }

  if (cityMenu.classList.contains("visible")) {
    const cityNames = countries.map((country) => country.name);
    cityMenu.innerHTML = `<button id="close-menu" class="close-button">&times;</button>`;

    cityNames.forEach((city) => {
      const cityDiv = document.createElement("div");
      cityDiv.classList.add("city-option");
      cityDiv.textContent = city;
      cityDiv.onclick = () => {
        const index = countries.findIndex((c) => c.name === city);
        updateCountryWithAnimation(index);
        cityMenu.classList.remove("visible");
        countryInfo.classList.remove("hidden");
        setTimeout(() => {
          cityMenu.style.display = "none";
        }, 500);
      };
      cityMenu.appendChild(cityDiv);
    });

    document.getElementById("close-menu").addEventListener("click", () => {
      cityMenu.classList.remove("visible");
      countryInfo.classList.remove("hidden");
      setTimeout(() => {
        cityMenu.style.display = "none";
      }, 500);
    });
  }
});
