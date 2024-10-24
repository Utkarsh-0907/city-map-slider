let countries = [];
let currentIndex = 0;
let map;
let activeInfoWindow = null;
let currentPolygon = null;
let markers = [];
let preloadedImages = new Map();

function preloadImages(cafes) {
  const loadPromises = [];

  cafes.forEach((cafe) => {
    cafe.images.forEach((imgUrl) => {
      if (!preloadedImages.has(imgUrl)) {
        const loadPromise = new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            preloadedImages.set(imgUrl, img);
            resolve(img);
          };
          img.onerror = () =>
            reject(new Error(`Failed to load image: ${imgUrl}`));
          img.src = imgUrl;
        });
        loadPromises.push(loadPromise);
      }
    });
  });

  return Promise.all(loadPromises);
}

function loadKml(url) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout loading KML")), 5000)
  );

  const fetchKml = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
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
          .filter((pair) => pair.length > 0)
          .map((pair) => {
            const [lng, lat] = pair.split(",").map(Number);
            return { lat, lng };
          })
      );
      return coordinates;
    });

  return Promise.race([fetchKml, timeout]);
}

fetch("countries.json")
  .then((response) => {
    if (!response.ok) throw new Error("Network response was not ok");
    return response.json();
  })
  .then((data) => {
    countries = data;
    return Promise.all(
      countries.map((country) =>
        country.cafes ? preloadImages(country.cafes) : Promise.resolve()
      )
    );
  })
  .then(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const countryParam = urlParams.get("country");
    currentIndex = countries.findIndex(
      (country) => country.name === countryParam
    );

    if (currentIndex === -1) currentIndex = 0;
    updateCountryInfo();
  })
  .catch((error) => {
    console.error("Error loading countries or preloading images:", error);
    const errorDiv = document.createElement("div");
    errorDiv.setAttribute("class", "error-message");
    errorDiv.textContent =
      "Failed to load country data. Please refresh the page.";
    document.body.appendChild(errorDiv);
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
    option.setAttribute("class", "city-option");
    option.textContent = country.name;
    option.onclick = () => {
      updateCountryWithAnimation(index);
      cityMenu.setAttribute("class", "city-menu hidden");
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
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
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
      optimized: true,
    });

    markers.push(marker);

    const infowindow = new google.maps.InfoWindow({
      content: createInfoWindowContent(cafe),
      maxWidth: 300,
      disableAutoPan: true,
    });

    let isMouseOverWindow = false;
    let isMouseOverMarker = false;

    marker.addListener("mouseover", () => {
      isMouseOverMarker = true;
      if (activeInfoWindow) {
        activeInfoWindow.close();
      }

      const imagesToLoad = cafe.images.map((imgUrl) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve;
          img.src = imgUrl;
        });
      });

      Promise.all(imagesToLoad).then(() => {
        infowindow.open(map, marker);
        activeInfoWindow = infowindow;
        initializeSlider(cafe.name);
      });
    });

    marker.addListener("mouseout", () => {
      isMouseOverMarker = false;
      setTimeout(() => {
        if (!isMouseOverWindow && !isMouseOverMarker) {
          infowindow.close();
          activeInfoWindow = null;
        }
      }, 100);
    });

    google.maps.event.addListener(infowindow, "domready", () => {
      const windowContent = document.querySelector(".gm-style-iw");
      if (windowContent) {
        windowContent.addEventListener("mouseenter", () => {
          isMouseOverWindow = true;
        });

        windowContent.addEventListener("mouseleave", () => {
          isMouseOverWindow = false;
          setTimeout(() => {
            if (!isMouseOverMarker && !isMouseOverWindow) {
              infowindow.close();
              activeInfoWindow = null;
            }
          }, 100);
        });
      }
    });
  });

  const bounds = new google.maps.LatLngBounds();
  countryBounds.forEach((coord) => bounds.extend(coord));
  cafes.forEach((cafe) => bounds.extend(cafe.coordinates));
  map.fitBounds(bounds);

  const mapElement = document.getElementById("map");
  mapElement.setAttribute("class", "map");
  requestAnimationFrame(() => {
    mapElement.setAttribute("class", "map visible");
  });
}

function createInfoWindowContent(cafe) {
  const images = cafe.images
    .map(
      (img, index) => `
      <div class="slider-image-container">
        <img 
          src="${img}" 
          alt="${cafe.name}"
          class="slider-image ${preloadedImages.has(img) ? "loaded" : ""}"
          loading="${index === 0 ? "eager" : "lazy"}"
          onload="this.classList.add('loaded')"
          onerror="this.onerror=null; this.src='placeholder.jpg';"
        />
        <div class="image-loader"></div>
      </div>`
    )
    .join("");

  return `
    <div class="info-window">
      <div class="slider-container">
        <button class="slick-prev slick-arrow" aria-label="Previous" type="button">Previous</button>
        <div class="slider" id="slider-${cafe.name.replace(/\s+/g, "-")}">
          ${images}
        </div>
        <button class="slick-next slick-arrow" aria-label="Next" type="button">Next</button>
      </div>
      <h3>${cafe.name}</h3>
      <p>${cafe.description}</p>
    </div>`;
}

function initializeSlider(cafeName) {
  const sliderId = `#slider-${cafeName.replace(/\s+/g, "-")}`;
  const sliderElement = $(sliderId);
  const images = sliderElement.find("img").toArray();

  const loadPromises = images.map((img) => {
    return new Promise((resolve) => {
      img.onload = () => {
        img.classList.add("loaded");
        resolve();
      };
      img.onerror = () => resolve();
      img.src = img.src;
    });
  });

  Promise.all(loadPromises).then(() => {
    sliderElement.slick({
      dots: true,
      infinite: true,
      speed: 500,
      fade: true,
      cssEase: "linear",
      autoplay: true,
      autoplaySpeed: 3000,
      lazyLoad: "ondemand",
      prevArrow: sliderElement.parent().find(".slick-prev"),
      nextArrow: sliderElement.parent().find(".slick-next"),
    });
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

function showLeftPanel() {
  const leftContainer = document.querySelector(".left");
  leftContainer.style.transform = "translateX(0)";
}

window.onload = () => {
  const leftContainer = document.querySelector(".left");
  leftContainer.style.transform = "translateX(0)";
  showLeftPanel();
};

function updateCountryWithAnimation(newIndex) {
  const leftContainer = document.querySelector(".left");
  leftContainer.style.transform = "translateX(-100%)";

  setTimeout(() => {
    currentIndex = newIndex;
    updateUrlParameter("country", countries[currentIndex].name);
    updateCountryInfo();
    leftContainer.style.transform = "translateX(0)";
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

  if (cityMenu.getAttribute("class").indexOf("visible") === -1) {
    cityMenu.setAttribute("class", "city-menu visible");
    countryInfo.setAttribute("class", "hidden");
    cityMenu.style.display = "flex";
  } else {
    cityMenu.setAttribute("class", "city-menu");
    countryInfo.removeAttribute("class");

    setTimeout(() => {
      cityMenu.style.display = "none";
    }, 500);
  }

  if (cityMenu.getAttribute("class").indexOf("visible") !== -1) {
    const cityNames = countries.map((country) => country.name);
    cityMenu.innerHTML = `<button id="close-menu" class="close-button">&times;</button>`;

    cityNames.forEach((city) => {
      const cityDiv = document.createElement("div");
      cityDiv.setAttribute("class", "city-option");
      cityDiv.textContent = city;
      cityDiv.onclick = () => {
        const index = countries.findIndex((c) => c.name === city);
        updateCountryWithAnimation(index);
        cityMenu.setAttribute("class", "city-menu");
        countryInfo.removeAttribute("class");
        setTimeout(() => {
          cityMenu.style.display = "none";
        }, 500);
      };
      cityMenu.appendChild(cityDiv);
    });

    document.getElementById("close-menu").addEventListener("click", () => {
      cityMenu.setAttribute("class", "city-menu");
      countryInfo.removeAttribute("class");
      setTimeout(() => {
        cityMenu.style.display = "none";
      }, 500);
    });
  }
});
