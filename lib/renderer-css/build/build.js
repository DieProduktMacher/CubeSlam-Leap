
/**
 * Require the given path.
 *
 * @param {String} path
 * @return {Object} exports
 * @api public
 */

function require(path, parent, orig) {
  var resolved = require.resolve(path);

  // lookup failed
  if (null == resolved) {
    orig = orig || path;
    parent = parent || 'root';
    var err = new Error('Failed to require "' + orig + '" from "' + parent + '"');
    err.path = orig;
    err.parent = parent;
    err.require = true;
    throw err;
  }

  var module = require.modules[resolved];

  // perform real require()
  // by invoking the module's
  // registered function
  if (!module.exports) {
    module.exports = {};
    module.client = module.component = true;
    module.call(this, module.exports, require.relative(resolved), module);
  }

  return module.exports;
}

/**
 * Registered modules.
 */

require.modules = {};

/**
 * Registered aliases.
 */

require.aliases = {};

/**
 * Resolve `path`.
 *
 * Lookup:
 *
 *   - PATH/index.js
 *   - PATH.js
 *   - PATH
 *
 * @param {String} path
 * @return {String} path or null
 * @api private
 */

require.resolve = function(path) {
  if (path.charAt(0) === '/') path = path.slice(1);

  var paths = [
    path,
    path + '.js',
    path + '.json',
    path + '/index.js',
    path + '/index.json'
  ];

  for (var i = 0; i < paths.length; i++) {
    var path = paths[i];
    if (require.modules.hasOwnProperty(path)) return path;
    if (require.aliases.hasOwnProperty(path)) return require.aliases[path];
  }
};

/**
 * Normalize `path` relative to the current path.
 *
 * @param {String} curr
 * @param {String} path
 * @return {String}
 * @api private
 */

require.normalize = function(curr, path) {
  var segs = [];

  if ('.' != path.charAt(0)) return path;

  curr = curr.split('/');
  path = path.split('/');

  for (var i = 0; i < path.length; ++i) {
    if ('..' == path[i]) {
      curr.pop();
    } else if ('.' != path[i] && '' != path[i]) {
      segs.push(path[i]);
    }
  }

  return curr.concat(segs).join('/');
};

/**
 * Register module at `path` with callback `definition`.
 *
 * @param {String} path
 * @param {Function} definition
 * @api private
 */

require.register = function(path, definition) {
  require.modules[path] = definition;
};

/**
 * Alias a module definition.
 *
 * @param {String} from
 * @param {String} to
 * @api private
 */

require.alias = function(from, to) {
  if (!require.modules.hasOwnProperty(from)) {
    throw new Error('Failed to alias "' + from + '", it does not exist');
  }
  require.aliases[to] = from;
};

/**
 * Return a require function relative to the `parent` path.
 *
 * @param {String} parent
 * @return {Function}
 * @api private
 */

require.relative = function(parent) {
  var p = require.normalize(parent, '..');

  /**
   * lastIndexOf helper.
   */

  function lastIndexOf(arr, obj) {
    var i = arr.length;
    while (i--) {
      if (arr[i] === obj) return i;
    }
    return -1;
  }

  /**
   * The relative require() itself.
   */

  function localRequire(path) {
    var resolved = localRequire.resolve(path);
    return require(resolved, parent, path);
  }

  /**
   * Resolve relative to the parent.
   */

  localRequire.resolve = function(path) {
    var c = path.charAt(0);
    if ('/' == c) return path.slice(1);
    if ('.' == c) return require.normalize(p, path);

    // resolve deps by returning
    // the dep in the nearest "deps"
    // directory
    var segs = parent.split('/');
    var i = lastIndexOf(segs, 'deps') + 1;
    if (!i) i = 0;
    path = segs.slice(0, i + 1).join('/') + '/deps/' + path;
    return path;
  };

  /**
   * Check if module is defined at `path`.
   */

  localRequire.exists = function(path) {
    return require.modules.hasOwnProperty(localRequire.resolve(path));
  };

  return localRequire;
};
require.register("renderer-css/index.js", function(exports, require, module){
var debug = require('debug')('renderer:css')
  , settings = require('../settings')
  , actions = require('../actions')
  , stash = require('stash')
  , cssEvent = require('css-emitter')
  , World = require('../world')
  , Bear = require('./bear')
  , Shield = require('./shield')
  , Paddle = require('./paddle')
  , Puck = require('./puck')
  , Bullet = require('./bullet')
  , Extra = require('./extra')
  , Effects = require('./effects')
  , Obstacle = require('./obstacle')
  , pool = require('../support/pool')
  , $ = require('jquery');

module.exports = Renderer;

function Renderer(element){
  this.element = element;

  this.arena = $('.arena', $(this.element))[0];

  this.width = 580;
  this.height = 760;
  //Calcultaded matrix for element transforms.
  this.matrix = 'matrix3d(1, 0, 0, 0, 0, 0.11667073709933327, 0.993170649538486, 0, 0, -0.993170649538486, 0.11667073709933327, 0, 0, 133.06863596332892, -778.6025754663666, 1) '

  this.arenaWidth = settings.data.arenaWidth;
  this.arenaHeight = settings.data.arenaHeight;

  this.arenaScaleW = this.width / this.arenaWidth;
  this.arenaScaleH = this.height / this.arenaHeight;

  // renderer bodies
  this.extras = stash()
  this.obstacles = stash()
  this.forces = stash()
  this.bullets = stash()
  this.pucks = stash()
  this.paddles = stash()
  this.shields = stash()

  this.setupAddedRemoved('game')
  this.bear = new Bear($('#expressions')[0]);

  this.paddlePlayer = new Paddle(this.element, 'p1', this)
  this.paddleCPU = new Paddle(this.element, 'p2', this)
}

Renderer.prototype = {
  setupAddedRemoved: function(worldName){
    if( this.onadded ){
      actions.off('added',this.onadded)
      actions.off('removed',this.onremoved)
    }

    this.onadded = function(type,world,body){
      if(world.name !== worldName) { return; }
      var obj;
      switch(type){
        case 'extra':
          obj = Extra.alloc().create(this.gamePiece(), body)
          this.extras.set(body.index,obj)
          break;
        case 'bullet':
          obj = Bullet.alloc().create(this.gamePiece(), body, this);
          this.bullets.set(body.index,obj)
          break;
        case 'puck':
          obj = Puck.alloc().create(this.gamePiece(), body, this);
          this.pucks.set(body.index,obj)
          break;
        case 'shield':
          obj = Shield.alloc().create(this.element, body, world);
          this.shields.set(body.index,obj)
          break;
        case 'force':
          obj = createForce(this.gamePiece(), body)
          this.forces.set(body.index,obj)
          break;
        case 'obstacle':
          obj = Obstacle.alloc().create(body);
          this.obstacles.set(body.index,obj)
          break;
        default:
          throw new Error('invalid type: '+type);
      }
    }.bind(this)

    this.onremoved = function(type,world,body){
      if(world.name !== worldName)  { return; }
      switch(type){
        case 'extra':
          this.extras.get(body.index).remove()
          this.extras.del(body.index);
          break;
        case 'bullet':
          this.bullets.get(body.index).remove();
          this.bullets.del(body.index);
          break;
        case 'puck':
          this.pucks.get(body.index).remove();
          this.pucks.del(body.index);
          break;
        case 'shield':
          this.shields.get(body.index).remove();
          this.shields.del(body.index)
          if(window.navigator.vibrate) {
            window.navigator.vibrate([100, 100])
          }
          break;
        case 'force':
          removeForce(this.forces.get(body.index));
          this.forces.del(body.index);
          break;
        case 'obstacle':
          this.obstacles.get(body.index).remove();
          this.obstacles.del(body.index);
          break;
        default:
          throw new Error('invalid type: '+type);
      }
    }.bind(this)

    actions.on('added',this.onadded)
    actions.on('removed',this.onremoved)
  },

  reset: function(){
    debug('reset')

    // remove all forces/extras/pucks
    while(this.pucks.values.length) {
      this.pucks.values.pop().remove()
    }
    while(this.forces.values.length) {
      removeForce(this.forces.values.pop());
    }
    while(this.extras.values.length) {
      this.extras.values.pop().remove()
    }
    while(this.obstacles.values.length) {
      this.obstacles.values.pop().remove()
    }
    while(this.bullets.values.length) {
      this.bullets.values.pop().remove()
    }
    while(this.shields.values.length) {
      this.shields.values.pop().reset()
    }

    this.pucks.empty()
    this.forces.empty()
    this.extras.empty()
    this.bullets.empty()
    this.obstacles.empty()
    this.shields.empty()

    Effects.toggleFog(false);
    Effects.mirroredControls(false);

  },
  triggerEvent: function(id, paramObj){
    debug('triggerEvent',arguments)
    switch(id) {
      case 'hitOpponent':
        this.bear.change('angry');
        Effects.puckHit('me');
        if(window.navigator.vibrate) {
          window.navigator.vibrate([200, 500, 200])
        }
        break;
      case 'hitMe':
        this.bear.change('flirt');
        Effects.puckHit('opponent')
        if(window.navigator.vibrate) {
          window.navigator.vibrate([100, 100, 100])
        }
        break;
      case 'gameStart':
        this.bear.change('jawdrop');
        break;
      case 'toggleFog':
        Effects.toggleFog(paramObj.active, id==1)
        break;
      case 'mirrorEffect':
        Effects.mirroredControls(paramObj.active);
        break;
      case 'paddleResize':
      case 'puckBounce':
      case 'resetPaddles':
      case 'paddleHit':
      case 'activateExtra':
        break;
      default:
        console.warn('cssrenderer - missing event', id);
        break;
    }
  },

  gamePiece: function(){
    return GamePiece.alloc().create(this.arena)
  },

  changeView: function(){
    debug('changeView',arguments)
  },

  getWorldCoordinate: function(){
    debug('getWorldCoordinate',arguments)
  },

  activePlayer: function(id, init, multiplayer){
    debug('activePlayer',arguments)
    if( multiplayer ){
      this.setupAddedRemoved('sync')
    } else {
      this.setupAddedRemoved('game')
    }
  },

  swapToVideoTexture: function(){
    debug('swapToVideoTexture',arguments)
  },

  render: function(world, alpha){
    this.bear.render(world);

    if( world.state === World.PLAYING || world.state === World.PREVIEW ) {
      //Update paddles
      this.paddlePlayer.update(this, alpha, world.paddles.get(world.players.a.paddle))
      this.paddleCPU.update(this, alpha, world.paddles.get(world.players.b.paddle))
    } else if(world.paddles.length < 1) {
      //Reset to center
      this.paddlePlayer.updateToCenter(this)
      this.paddleCPU.updateToCenter(this)
    }

    if(world.state !== World.PLAYING){
      return;
    }
    var i = 0;
    // update pucks
    for(i=0; i < world.pucks.values.length; i++){
      var puck = world.pucks.values[i]
      this.pucks.get(puck.index).update(this, alpha);
    }

    // update extras
    for(i=0; i < world.extras.values.length; i++){
      var extra = world.extras.values[i]
      this.extras.get(extra.index).update(this, alpha)
    }

    // update shields
    for(i=0; i < world.shields.values.length; i++){
      var shield = world.shields.values[i]
      this.shields.get(shield.index).update(this)
    }

    // update forces
    for(i=0; i < world.forces.values.length; i++){
      var force = world.forces.values[i]
        , div = this.forces.get(force.index)
      div.setAttribute('class', force.active ? 'effect force active' : 'effect force' );
    }

    // update bullets
    for(i=0; i < world.bullets.values.length; i++){
      var bullet = world.bullets.values[i]
      this.bullets.get(bullet.index).update(this, alpha);
    }
  },

  updatePosition:function(piece, alpha){
    var x = piece.body.current[0]*alpha + piece.body.previous[0]*(1-alpha);
    var y = piece.body.current[1]*alpha + piece.body.previous[1]*(1-alpha);

    var w = piece.width||0;
    piece.sprite = parseInt((x-w)/(this.arenaWidth-w*2) * (piece.sprites-1), 10)+1

    piece.x = x * this.arenaScaleW;
    piece.y = y * this.arenaScaleH;
  }
}

function GamePiece(){
  this.element = null;
}

GamePiece.prototype = {
  create: function(arena){
    if( this.element ) {
      return this;
    }

    arena = $(arena);
    this.element = $('<div class="empty"><div class="icon"></div></div>');
    arena.append(this.element);
    return this;
  },
  remove: function(){
    this.element[0].setAttribute('class', 'empty');
    GamePiece.free(this);
  }
}

pool(GamePiece, 10)

function createForce(world,body){
  debug('create force',body.index);
  return $('.effect.force').addClass('active')[0];
}
function removeForce(world,body){
  debug('remove force')
  $('.effect.force').removeClass('active');
}
});
require.register("renderer-css/bear.js", function(exports, require, module){
var debug = require('debug')('renderer:css')

module.exports = Bear;

function Bear(element){
  this.el = element;
  this.expression = {list:[]};
  this.index = 0
}

Bear.prototype = {
  change: function(to, world){
    var self = this;
    switch(to) {
      case 'angry':
        // this.expressions = [];
        this.expression = {
          name: 'angry',
          list: [0,1,2,3,4,4,4,4,4,4,4,4,4,4,4,3,2,1,0]
        }
        break;
      case 'jawdrop':
        this.expression = {
          name: 'jawdrop',
          list: [0,1,2,3,4,4,4,4,4,4,4,4,4,4,4,4,3,2,1,0]
        }
        break;
      case 'flirt':
        this.expression = {
          name: 'flirt',
          list: [0,1,2,3,4,5,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,5,4,3,2,1,0]
        }
    }
  },
  render: function(world) {
    this.index++;
    if(this.expression.list.length > 0 && this.index % 4 === 0) {
      var name = this.expression.name
        , expression = expressions[name]
        , bg = this.expression.list.shift()
        , style = this.el.style;
      style.backgroundPosition = expression['bg'][bg];

      if( name != this.current ) {
        this.current = name;
        style.width = expression.width;
        style.height = expression.height

        this.el.setAttribute('class', name);
        this.index = 0;
      }
    } else {
      if((this.index) % (14*7) === 0) {
        this.expression = {
          name: 'blink',
          list: [0,0,0,1,1,0,0,0,0,0,0,0,0,0]
        }
      }
    }
  }
}

var expressions = {
  angry: {
    bg: [
      '-320px -99px',
      '-214px -99px',
      '-108px -150p',
      '-610px -2px',
      '-504px -2px',
      '-398px -2px',
      '-292px -2px',
      '-186px -2px'
    ],
    width: '104px',
    height: '95px'
  },
  blink: {
    bg: [
      '-634px -222px',
      '-634px -202px'
    ],
    width: '56px',
    height: '18px'
  },
  flirt: {
    bg: [
      '-610px -151px',
      '-565px -202px',
      '-541px -151px',
      '-496px -202px',
      '-427px -202px',
      '-472px -151px',
      '-358px -196px'
    ],
    width: '67px',
    height: '49px'
  },
  jawdrop: {
    bg: [
      '-286px -196px',
      '-214px -196px',
      '-642px -99px',
      '-570px -99px',
      '-498px -99px',
      '-426px -99px'
    ],
    width: '70px',
    height: '50px'
  }
}

});
require.register("renderer-css/extra.js", function(exports, require, module){
var debug = require('debug')('renderer:css:extra')
  , pool = require('../support/pool')
  , $ = require('jquery');

module.exports = Extra;

function Extra(){
}

Extra.prototype = {
  create: function(piece, body){
    this.body = body;
    this.piece = piece;
    this.element = piece.element.attr('class', 'extra ' + body.data.id)[0];
    this.sprites = 1;
    this.rendered = false;
    return this;
  },
  update: function(renderer, alpha){
    if(this.rendered)
      return;
    this.rendered = true;
    renderer.updatePosition(this, alpha)
    var transform  = renderer.matrix + 'rotateX(-90deg) translate3d('+(this.x-31)+'px,-50%,'+this.y+31+'px)'
      , style = this.element.style;

    style.webkitTransform = transform;
    style.msTransform = style.MozTransform = style.OTransform = transform;
  },
  remove: function(){
    this.element.setAttribute('class', 'empty');
    this.element.removeAttribute('style');
    this.piece.remove();
    Extra.free(this);
  }
}
pool(Extra, 4)
});
require.register("renderer-css/effects.js", function(exports, require, module){
var debug = require('debug')('renderer:css:effects')
  , cssEvent = require('css-emitter')
  , $ = require('jquery');

module.exports = Effects;

function Effects(){

}

Effects.puckHit = function(player){
  var elem;
  if(player == 'opponent') {
    elem = $('#canv-css .screen .hit-cpu');
  } else {
    elem = $('#canv-css .screen .hit-player');
  }
  cssEvent(elem[0]).once('end', function(){
    elem.removeClass('active');  
  })
  elem.addClass('active');
}

Effects.toggleFog = function(active){
  var fog = $('#canv-css .effects .effect.fog');
  if( active ) {
    fog.addClass('active')
  } else {
    fog.removeClass('active');
  }
}

//Position from 0-1, 1 is p2. 
Effects.bombBlast = function(position){
  var player = position > .5 ? 'p1' : 'p2'
    , elem = $('#canv-css .effects .effect.explosion.'+player);
  elem.addClass('active')
  setTimeout(function(){
    elem.removeClass('active');
  }, 1000)
}



Effects.mirroredControls = function( active ){
    if( Effects.mirrorEffectActive == active ) 
      active = false;
    Effects.mirrorEffectActive = active;

    if( active ) {
      $('body').addClass('mirror')
    } else {
      $('body').removeClass('mirror')
    }
}

});
require.register("renderer-css/obstacle.js", function(exports, require, module){
var debug = require('debug')('renderer:css:effects')
  , cssEvent = require('css-emitter')
  , pool = require('../support/pool')
  , $ = require('jquery');

module.exports = Obstacle;

function Obstacle(){
}

Obstacle.prototype = {
  create: function(body) {
    this.body = body;
    this.id = body.data.id;
    switch(this.id) {
      case 'triangle-right':
      case 'triangle-left':
      case 'diamond':
      case 'octagon':
      case 'block-rect':
        this.element = $('.obstacle.'+this.id).addClass('active')[0];
      case 'block-breakout':
        // TODO?
        break;

      default:
        throw new Error('unsupported obstacle: '+this.id)
    }
    return this;
  },
  remove: function(){
    $(this.element).removeClass('active');
    Obstacle.free(this);
  }
}

pool(Obstacle, 2)
});
require.register("renderer-css/shield.js", function(exports, require, module){
var debug = require('debug')('renderer:css:shield')
  , cssEvent = require('css-emitter')
  , pool = require('../support/pool')
  , $ = require('jquery');

module.exports = Shield;

function Shield(){
}

Shield.prototype = {
  create: function(parent,body,world){
    var shields = world.players[body.data.player].shields.length
      , index = body.data.index+1
     , cName = 'shield active visible s'+shields + '-' + (index<0 ? index : '0'+index);
    this.body = body;
    this.bulletproof = false;
    this.element = $(parent)
      .find('.shields-'+body.data.player)
      .children().eq(index-1)[0];
    cssEvent(this.element).off('end');
    
    this.element.setAttribute('class', cName);
    this.cName = cName.replace(' visible', ' ');

    return this;
  },
  update: function(){
    if( this.body.data.bulletproof != this.bulletproof ) {
      if(this.body.data.bulletproof==1) {
        $(this.element).addClass('bulletproof')
      } else{
        $(this.element).removeClass('bulletproof')
      }
      this.bulletproof = this.body.data.bulletproof;
    }
  },
  reset: function(){
    if(this.bulletproof) {
      $(this.element).removeClass('bulletproof')
    }
    cssEvent(this.element).off('end');
    Shield.free(this)
  },
  remove: function(){
    this.element.setAttribute('class',this.cName + ' hit');
    var c = this.cName;
    cssEvent(this.element).once('end',function(){
      if($(this.element).hasClass('hit')) {
        $(this.element).removeClass('visible');
      }
    }.bind(this))
    Shield.free(this)
  }
}

pool(Shield, 18)
});
require.register("renderer-css/puck.js", function(exports, require, module){
var debug = require('debug')('renderer:css:puck')
  , Effects = require('./effects')
  , pool = require('../support/pool')
  , $ = require('jquery');

module.exports = Puck;

function Puck(){
}

Puck.prototype = {
  create: function(piece, body, renderer){
    this.piece = piece;
    this.element = piece.element.attr('class', 'puck')[0];
    this.body = body;
    this.sprites = 31;
    this.ghostball = 0;
    this.fireball = 0;
    var transform = renderer.matrix + 'rotateX(-90deg) translate3d(264px, -50%, 380px) '
      , style = this.element.style;
    style.transform = style.webkitTransform = style.msTransform = style.MozTransform = style.OTransform = transform;
    style.overflow = 'hidden';
    style.backgroundPosition = puckPosition[16];
    return this;
  },
  update: function(renderer, alpha){
    renderer.updatePosition(this, alpha)
    var transform = renderer.matrix + 'rotateX(-90deg) translate3d('+(this.x-26)+'px,-50%,'+(this.y+26)+'px)'
      , style = this.element.style;
    style.transform = style.webkitTransform = style.msTransform = style.MozTransform = style.OTransform = transform;

    var oldCname = this.cName
      , puckBody = this.body;
    this.cName = 'puck';

    toggleEffect(this,'fireball',puckBody.data.fireball)
    toggleEffect(this,'ghostball',puckBody.data.ghostball)

    // bomb (1=turn on, 2=turn off, undefined/0=ignore) 
    if( puckBody.data.timebomb ) {
      if( puckBody.data.timebomb == 2) {
        Effects.bombBlast(this.y/renderer.height)
      }
      toggleEffect(this,'timebomb',puckBody.data.timebomb)
    }
    
    if(oldCname!=this.cName) {
      this.element.setAttribute('class', this.cName);

    }

    if( this.sprite != this.oldSprite ) {
      if(this.fireball==1) {
        style.backgroundPosition = fireBallPosition[this.sprite];
      } else {
        style.backgroundPosition = puckPosition[this.sprite];
      }
      this.oldSprite = this.sprite;
    }

  },
  reset: function(){

  },
  remove: function(){
    this.piece.remove();
    Puck.free(this);
  }
}

function toggleEffect(puck,prop,state){
  if( state === 1 && !puck[prop] ) {
    puck[prop] = state;
    return state;
  } else if( (state === 2 || state === 0) && puck[prop] ) {
    puck[prop] = 0
    return 0; // set state back to 0
  } else if( puck[prop] ) {
    // skin.update();
    puck.cName += ' ' + prop;
    return state;
  }
}


var puckPosition = [
  '-1622px -56px',
  '-1622px -2px',
  '-1568px -56px',
  '-1568px -2px',
  '-1514px -56px',
  '-1514px -2px',
  '-1460px -56px',
  '-1460px -2px',
  '-1406px -56px',
  '-1406px -2px',
  '-1352px -56px',
  '-1352px -2px',
  '-1298px -56px',
  '-1298px -2px',
  '-1244px -56px',
  '-1244px -2px',
  '-1190px -56px',
  '-1190px -2px',
  '-1136px -56px',
  '-1136px -2px',
  '-1082px -56px',
  '-1082px -2px',
  '-1028px -56px',
  '-1028px -2px',
  '-974px -56px',
  '-974px -2px',
  '-920px -56px',
  '-920px -2px',
  '-866px -56px',
  '-866px -2px',
  '-812px -56px'
]

var fireBallPosition = [
  '-812px -2px',
  '-758px -56px',
  '-758px -2px',
  '-704px -56px',
  '-704px -2px',
  '-650px -56px',
  '-650px -2px',
  '-596px -56px',
  '-596px -2px',
  '-542px -56px',
  '-542px -2px',
  '-488px -56px',
  '-488px -2px',
  '-434px -56px',
  '-434px -2px',
  '-380px -56px',
  '-380px -2px',
  '-326px -56px',
  '-326px -2px',
  '-272px -56px',
  '-272px -2px',
  '-218px -56px',
  '-218px -2px',
  '-164px -56px',
  '-164px -2px',
  '-110px -56px',
  '-110px -2px',
  '-56px -56px',
  '-56px -2px',
  '-2px -56px',
  '-2px -2px'
]

pool(Puck, 2)
});
require.register("renderer-css/bullet.js", function(exports, require, module){
var debug = require('debug')('renderer:css:bullet')
  , pool = require('../support/pool')
  , $ = require('jquery');

module.exports = Bullet;

function Bullet(){
}

Bullet.prototype = {
  create: function(piece, body){
    this.piece = piece;
    this.element = piece.element.attr('class', 'bullet')[0];
    this.body = body;
    return this;
  },
  update: function(renderer, alpha){
    renderer.updatePosition(this, alpha)
    var transform = renderer.matrix + 'translate3d('+(this.x-13)+'px,'+(this.y+15)+'px,0px)'
      , style = this.element.style;
    style.transform = style.webkitTransform = style.msTransform = style.MozTransform = style.OTransform = transform;
  },
  reset: function(){

  },
  remove: function(){
    this.piece.remove();
    Bullet.free(this);
  }
}

pool(Bullet, 2)
});
require.register("renderer-css/paddle.js", function(exports, require, module){
var debug = require('debug')('renderer:css:padde')
  , dmaf = require('../dmaf.min')
  , $ = require('jquery');

module.exports = Paddle;

var elem = $('<div class="paddle player"><div class="gfx"></div></div>');

function Paddle(parent, player){
  this.sprites = 31;
  this.width = 179;
  this.player = player;
  this.element = elem.clone()
    .attr('id', player)
    .appendTo($(parent).find('.arena'))[0];

  this.gfx = this.element.children[0];
  this.sprite = 1;
  this.px = 0;
  this.scaleX = 1;
  //animate back with this amount of 'ease'
  this.centerAlpha = 6 + Math.random() * 20;
  this.resized = null;
  this.gfx.style.backgroundPosition = paddlePosition[this.player][this.player == 'p2' ? 0 : 15];
}

Paddle.prototype = {
  update: function(renderer, alpha, body, center){
    var gfxScale;

    if(body) {
      if(!this.body) {
        this.body = body;
      }

      renderer.updatePosition(this, alpha)

      var oldCname = this.cName;
      this.cName = '';

      // fireball (1=turn on, 2=turn off, undefined/0=ignore)
      if( body.data.fireball ) {
        body.data.fireball = toggleEffect(this,'fireball',body.data.fireball)
      }
      // laser (1=turn on, 2=turn off, undefined/0=ignore)
      if( body.data.laser ) {
        body.data.laser = toggleEffect(this,'laser',body.data.laser)
      }
      if(oldCname!=this.cName) {
        this.element.setAttribute('class', this.cName);
      }

      if(this.resized != body.data.resized) {
        var sc = body.data.resized ? body.data.resized : 1
          , dmafId = (this.player == 'p1' ?'user':'opponent') + '_paddle_'  + (sc > this.scaleX ?'grow':'shrink');
        dmaf.tell(dmafId);
        gfxScale = 'scaleX('+sc+')';
        this.scaleX = sc;
        this.resized = body.data.resized;
      }

    } else {
      var w = this.width*renderer.arenaScaleW
      this.sprite = parseInt((this.x-w)/(renderer.width-w*2) * (this.sprites-1), 10)+1;
      if(this.scaleX != 1) {
        gfxScale = 'scaleX(1)';
      }
      this.scaleX = 1;
    }
    if(gfxScale) {
      var s = this.gfx.style;
      s.transform = s.webkitTransform = s.msTransform = s.MozTransform = gfxScale;
    }

    if(Math.abs(this.px - this.x) < 1) {
      return;
    }

    var transform = renderer.matrix + 'rotateX(-90deg) translate3d('+(this.x-89)+'px,-50%,'+this.y+'px)'
      , style = this.element.style;

    style.transform = style.webkitTransform = style.msTransform = style.MozTransform = transform;
    if(this.player=='p1') {
      this.gfx.style.backgroundPosition = paddlePosition[this.player][this.sprite];
    }

    this.px = this.x;
  },
  updateToCenter: function(renderer){
    this.x += ((renderer.width/2)-this.x)/this.centerAlpha
    this.update(renderer)
  },
  remove: function(){
  }
}

function toggleEffect(paddle,prop,state){
  if(state === 1 && !paddle[prop]) {
    paddle.cName += ' ' + prop;
    paddle[prop] = state;
    return state;
  }
  else if(state === 2 && paddle[prop]) {
    paddle[prop] = 0;
    return 0; // set state back to 0
  }
  else if(paddle[prop]) {
    // skin.update();
    paddle.cName += ' ' + prop;
    return state;
  }
}

var paddlePosition = {
  p1: [
    '-1088px -167px',
    '-1269px -112px',
    '-1088px -112px',
    '-1269px -57px',
    '-1088px -57px',
    '-1269px -2px',
    '-1088px -2px',
    '-907px -167px',
    '-907px -112px',
    '-907px -57px',
    '-907px -2px',
    '-726px -167px',
    '-726px -112px',
    '-726px -57px',
    '-726px -2px',
    '-545px -167px',
    '-545px -112px',
    '-545px -57px',
    '-545px -2px',
    '-364px -167px',
    '-364px -112px',
    '-364px -57px',
    '-364px -2px',
    '-183px -167px',
    '-183px -112px',
    '-183px -57px',
    '-183px -2px',
    '-2px -167px',
    '-2px -112px',
    '-2px -57px',
    '-2px -2px'
  ],
  p2:[
    '0px 0px'
  ]
}
});