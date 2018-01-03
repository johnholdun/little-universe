 const sortBy = function(array, property) {
  const items = array.map((item, index) => (
    {
      item,
      index,
      criteria: item[property]
    }
  ));

  items.sort((left, right) => {
    var a = left.criteria;
    var b = right.criteria;

    if (a === b) {
      return left.index - right.index;
    }

    if (a > b || a === void 0) return 1;
    if (a < b || b === void 0) return -1;
  });

 return items.map(({ item }) => item);
};

const FULL_SCREEN = [
  {
    element: "fullscreenElement",
    request: "requestFullscreen",
    exit: "exitFullscreen"
  },
  {
    element: "webkitFullscreenElement",
    request: "webkitRequestFullscreen",
    exit: "webkitExitFullscreen"
  },
  {
    element: "mozFullScreenElement",
    request: "mozRequestFullScreen",
    exit: "mozCancelFullScreen"
  },
  {
    element: "msFullscreenElement",
    request: "msRequestFullscreen",
    exit: "msExitFullscreen"
  }
];

const toggleFullScreen = () => {
  FULL_SCREEN.forEach(({ element, request, exit }) => {
    if (!document[element] && typeof document.documentElement[request] === "function") {
      document.documentElement[request]();
    } else if (typeof document[exit] === "function") {
      document[exit]();
    }
  });
};

const loadImage = (url, object) => {
  const image = new Image();
  image.onload = () => {
    object.image = image;
  }
  image.src = url;
}

const INTERVAL = 16;
// Minimum number of pixels from player origin to edge of viewport before scrolling
const VIEWPORT_EDGE_BUFFER = 200;
// keys are (horizontal,vertical) where (1,1) is down/right
// values are degrees, where 0 is straight up
const DIRECTIONS = {
  "0,-1": 0,
  "1,-1": 45,
  "1,0": 90,
  "1,1": 135,
  "0,1": 180,
  "-1,1": 225,
  "-1,0": 270,
  "-1,-1": 315,
};

const SCALE_FACTOR = 0.5;

const TEXT_SPEED = 40;

let canvas;
let ctx;

const dim = {
  viewport: {
    w: 2560,
    h: 1440,
  }
};

const KEYS = {
  32: "mark",
  37: "left",
  38: "up",
  39: "right",
  40: "down",
  13: "debug"
};

const keysDown = {
  up: 0,
  down: 0,
  left: 0,
  right: 0,
  debug: 0
};

const game = {
  current: 0,
  viewport: {
    x: 222,
    y: 78,
    zone: "outside"
  },
  zones: [
    {
      id: "outside",
      color: "green",
      bounds: [
        { x: 10, y: 10 },
        { x: 3000, y: 1800 }
      ]
    },
    {
      id: "bakery",
      color: "pink",
      bounds: [
        { x: 10, y: 10 },
        { x: 3000, y: 1900 }
      ]
    }
  ],
  entities: [
    {
      id: "player",
      imageURL: "rabbit.png",
      image: null,
      x: 600,
      y: 800,
      zone: "outside",
      speed: 0,
      maxSpeed: 10,
      direction: 90,
      width: 166,
      height: 361,
      originX: 84,
      originY: 350,
      footprintW: 120,
      footprintH: 50,
    },
    {
      id: "bush1",
      imageURL: "bush.png",
      image: null,
      x: 690,
      y: 500,
      zone: "outside",
      width: 474,
      height: 608,
      originX: 240,
      originY: 600,
      footprintW: 400,
      footprintH: 80
    },
    {
      id: "bush2",
      inherit: "bush1",
      x: 2590,
      y: 600,
      zone: "outside"
    },
    {
      id: "lemurs",
      imageURL: "lemurs.png",
      image: null,
      x: 1400,
      y: 1200,
      zone: "bakery",
      width: 477,
      height: 704,
      originX: 240,
      originY: 699,
      footprintW: 300,
      footprintH: 80,
      message: {
        text: "Hiya, Rabbit! You’re looking mighty fast today.",
        appearedAt: null
      }
    },
    {
      id: "storefront",
      imageURL: "storefront.png",
      image: null,
      x: 1700,
      y: 600,
      zone: "outside",
      width: 1106,
      height: 851,
      originX: 563,
      originY: 707,
      footprintW: 1040,
      footprintH: 300
    },
    {
      id: "storefront-door",
      x: 1576,
      y: 750,
      zone: "outside",
      width: 240,
      height: 20,
      originX: 120,
      originY: 10,
      footprintW: 240,
      footprintH: 20,
      warp: {
        x: 1300,
        y: 1800,
        zone: "bakery"
      }
    },
    {
      id: "storefront-door-interior",
      image: null,
      imageURL: "interior.png",
      x: 1300,
      y: 1860,
      zone: "bakery",
      width: 1141,
      height: 82,
      originX: 570,
      originY: 40,
      footprintW: 1141,
      footprintH: 82,
      warp: {
        x: 1593,
        y: 830,
        zone: "outside"
      }
    }
  ]
};

const tick = function() {
  game.current = (new Date()).valueOf();

  readControls();

  applySpeed(game.entities[0]);

  constrainViewport();

  draw();

  setTimeout(tick, INTERVAL);
};

const getCollisions = (zone, a) => {
  return game.entities.filter((entity) => {
    if (entity.zone !== zone) {
      return false;
    }

    const b = getEntityBounds(entity);

    // If one rectangle is to the side of other
    if (a[0].x > b[1].x || a[1].x < b[0].x) {
      return false;
    }

    // If one rectangle is above other
    if (a[0].y > b[1].y || a[1].y < b[0].y) {
      return false;
    }

    return true;
  });
};

const getPotentialCollisions = (entity) => {
  const bounds = getBounds(
    entity.x + entity.speedX,
    entity.y + entity.speedY,
    entity.footprintW,
    entity.footprintH
  );

  const result = getCollisions(entity.zone, bounds).filter(e => e.id != entity.id);

  if (isOutOfZone(bounds)) {
    result.push(getZone());
  }


  return result;
};

const isOutOfZone = (entityBounds) => {
  const { bounds: zoneBounds } = getZone();
  if (!zoneBounds) {
    return false;
  }

  if (entityBounds[0].x < zoneBounds[0].x || entityBounds[1].x > zoneBounds[1].x) {
    return true;
  }

  if (entityBounds[0].y < zoneBounds[0].y || entityBounds[1].y > zoneBounds[1].y) {
    return true;
  }

  return false;
};

const getEntityBounds = (entity) => {
  return getBounds(entity.x, entity.y, entity.footprintW, entity.footprintH);
};

const getBounds = (x, y, w, h) => {
  const x1 = (x - (w / 2));
  const y1 = (y - (h / 2));

  return [
    {
      x: x1,
      y: y1
    },
    {
      x: (x1 + w),
      y: (y1 + h)
    }
  ];
};

const setSpeed = (entity, speed, direction) => {
  entity.speed = speed;
  entity.direction = direction;

  let delta;

  const speedDivSqrt2 = speed / Math.sqrt(2);

  // TODO: trigonometry
  switch(direction) {
    case 0:   delta = [0, -speed]; break;
    case 45:  delta = [speedDivSqrt2, -speedDivSqrt2]; break;
    case 90:  delta = [speed, 0]; break;
    case 135: delta = [speedDivSqrt2, speedDivSqrt2]; break;
    case 180: delta = [0, speed]; break;
    case 225: delta = [-speedDivSqrt2, speedDivSqrt2]; break;
    case 270: delta = [-speed, 0]; break;
    case 315: delta = [-speedDivSqrt2, -speedDivSqrt2]; break;
  }

  entity.speedX = delta[0];
  entity.speedY = delta[1];

}

const readControls = () => {
  let horizontal = 0;
  let vertical = 0;
  let direction;

  if (keysDown.left || keysDown.right) {
    horizontal = keysDown.left < keysDown.right ? 1 : -1;
  }

  if (keysDown.up || keysDown.down) {
    vertical = keysDown.up < keysDown.down ? 1 : -1;
  }

  const key = `${horizontal},${vertical}`;

  const user = game.entities[0];

  setSpeed(
    user,
    (key === "0,0" ? 0 : user.maxSpeed),
    (Object.keys(DIRECTIONS).indexOf(key) > -1 ? DIRECTIONS[key] : 90)
  );
};

const applySpeed = (entity) => {
  if (entity.speed === 0) {
    return;
  }

  const potentialCollisions = getPotentialCollisions(entity);

  if (potentialCollisions.length) {
    setSpeed(entity, 0, entity.direction);

    potentialCollisions.forEach((entity) => {
      if (entity.message && entity.message.appearedAt === null) {
        entity.message.appearedAt = game.current;
      }

      if (entity.warp) {
        const player = game.entities[0];
        const offsetX = player.x - game.viewport.x;
        const offsetY = player.y - game.viewport.y;
        Object.assign(player, entity.warp);
        game.viewport.zone = player.zone;
        game.viewport.x = player.x - offsetX;
        game.viewport.y = player.y - offsetY;
      }
    });

    return;
  }

  entity.x += entity.speedX;
  entity.y += entity.speedY;
};

// The screen will only scroll if a "safe area" surrounding the player reaches
// the edge of the viewport. When this happens, the screen will scroll just
// enough for the safe area to return entirely into view.
const constrainViewport = () => {
  const { viewport } = game;

  const { x, y, width, height } = getSafeAreaCoords();

  if (viewport.x > x) {
    viewport.x = x;
  }

  if (viewport.x < x - (dim.viewport.w - width)) {
    viewport.x = x - (dim.viewport.w - width);
  }

  if (viewport.y > y) {
    viewport.y = y;
  }

  if (viewport.y < y - (dim.viewport.h - height)) {
    viewport.y = y - (dim.viewport.h - height);
  }
};

const getSafeAreaCoords = () => {
  const user = game.entities[0];

  // The dimensions of the safe area are the full size of the character sprite
  // plus a buffer on all sides.
  const width = user.width + VIEWPORT_EDGE_BUFFER * 2;
  const height = user.height + VIEWPORT_EDGE_BUFFER * 2;

  // The safe area is centered on the user; these are the coordinates of its
  // top-left corner.
  const x = user.x - width / 2;
  const y = user.y - height / 2;

  return { x, y, width, height };
};

const drawZone = () => {
  const { color } = getZone();
  ctx.fillStyle = color || "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const drawEntities = () => {
  // TODO: Don't draw entities that are out of the viewport

  const { entities, viewport } = game;

  sortBy(entities, "y").forEach((entity) => {
    if (entity.zone !== game.viewport.zone) {
      return;
    }

    if (entity.image) {
      const tileIndex = 0;

      ctx.drawImage(
        entity.image,
        0,
        tileIndex * entity.height,
        entity.width,
        entity.height,
        Math.floor((entity.x - entity.originX - viewport.x) * SCALE_FACTOR),
        Math.floor((entity.y - entity.originY - viewport.y) * SCALE_FACTOR),
        Math.floor(entity.width * SCALE_FACTOR),
        Math.floor(entity.height * SCALE_FACTOR)
      );
    }

    handleText(entity);

    drawEntityDebug(entity);
  });
};

const drawEntityDebug = (entity) => {
  const { viewport } = game;

  if (!keysDown.debug) {
    return;
  }

  ctx.strokeStyle = "blue";
  ctx.strokeRect(
    Math.floor((entity.x - viewport.x - (entity.footprintW / 2)) * SCALE_FACTOR),
    Math.floor((entity.y - viewport.y - (entity.footprintH / 2)) * SCALE_FACTOR),
    entity.footprintW * SCALE_FACTOR,
    entity.footprintH * SCALE_FACTOR
  );

  if (entity.id === "player") {
    const { x, y, width, height } = getSafeAreaCoords();

    ctx.strokeStyle = "yellow";
    ctx.strokeRect(
      Math.floor((x - viewport.x) * SCALE_FACTOR),
      Math.floor((y - viewport.y) * SCALE_FACTOR),
      Math.floor(width * SCALE_FACTOR),
      Math.floor(height * SCALE_FACTOR)
    );
  }
}

const getZone = () => (game.zones.filter(z => z.id === game.viewport.zone)[0]);

const drawDiagnostics = () => {
  if (!keysDown.debug) {
    return;
  }

  const { bounds } = getZone();

  if (bounds) {
    ctx.strokeStyle = "orange";
    ctx.strokeRect(
      (bounds[0].x - game.viewport.x) * SCALE_FACTOR,
      (bounds[0].y - game.viewport.y) * SCALE_FACTOR,
      (bounds[1].x - bounds[0].x) * SCALE_FACTOR,
      (bounds[1].y - bounds[0].y) * SCALE_FACTOR
    );
  }

  const output = `FPS TODO - (${Math.round(game.entities[0].x)}, ${Math.round(game.entities[0].y)}) - (${game.viewport.x}, ${game.viewport.y})`;
  const measurements = ctx.measureText(output);
  ctx.fillStyle = "black";
  ctx.fillRect(
    0,
    canvas.height - 12,
    Math.ceil(measurements.width) + 4,
    12 + 4
  );
  ctx.fillStyle = "white";
  ctx.font = "10px monospace";
  ctx.fillText(output, 2, canvas.height - 2);
}

const draw = () => {
  drawZone();

  drawEntities();

  drawDiagnostics();
};

const wrapText = (text, x, startY, maxWidth, lineHeight) => {
  const words = text.split(' ');
  let line = '';
  let y = startY;

  words.forEach((word, i) => {
    const testLine = `${line}${word} `;
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = `${word} `;
      y += lineHeight;
    } else {
      line = testLine;
    }
  });

  ctx.fillText(line, x, y);
};

const handleText = (entity) => {
  if (!entity.message || entity.message.appearedAt === null) {
    return;
  }

  const text = entity.message.text.substring(
    0,
    Math.ceil((game.current - entity.message.appearedAt) / TEXT_SPEED)
  );

  const x =
    Math.max(
      20,
      (entity.x - game.viewport.x + entity.width / 2 + 10)
    ) * SCALE_FACTOR;
  const y =
    Math.max(
      20,
      (entity.y - game.viewport.y - entity.height)
    ) * SCALE_FACTOR;
  const w = 200;
  const h = 100;
  const padding = 10;

  ctx.font = "12px Helvetica";
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "white";
  wrapText(text, x + padding, y + 12 + padding, w - padding * 2, 16);
};

addEventListener("keydown", (e) => {
  // if (e.which === 70) {
  //   toggleFullScreen();
  //   return true;
  // }

  if (!KEYS[e.which]) {
    // console.log(`Unrecognized key ${e.which}`);
    return;
  }

  keysDown[KEYS[e.which]] = (new Date()).valueOf();
});

addEventListener("keyup", (e) => {
  if (!KEYS[e.which]) {
    return;
  }

  keysDown[KEYS[e.which]] = 0;
});

document.addEventListener("visibilitychange", (e) => {
  // Cancel all key states

  Object.keys(KEYS).forEach((key) => {
    keysDown[KEYS[key]] = 0;
  });
});

addEventListener("load", function() {
  canvas = document.querySelector("#canvas");

  const dimension = Math.floor(SCALE_FACTOR * dim.viewport.w);

  canvas.setAttribute("width", dimension);
  canvas.setAttribute("height", Math.ceil(dimension * dim.viewport.h / dim.viewport.w));
  canvas.style.width = `${dimension}px`;
  canvas.style.height = `${Math.ceil(dimension * dim.viewport.h / dim.viewport.w)}px`;
  canvas.style.margin = `${Math.ceil(dimension * dim.viewport.h / dim.viewport.w / -2)}px ${dimension / -2}px`;

  ctx = canvas.getContext("2d");

  game.entities.forEach((entity) => {
    if (entity.inherit) {
      inherited = game.entities.filter(e => e.id === entity.inherit)[0];
      Object.assign(entity, Object.assign({}, inherited, entity));
    }

    if (!entity.imageURL) {
      return;
    }

    loadImage(entity.imageURL, entity);
  });

  tick();
});
