// 消息中心连接 musicPage 与 footer两个部分
var EventCenter = {
  on: function(type, handler){
    $(document).on(type, handler)
  },
  fire: function(type, data){
    return $(document).trigger(type, data)
  }
}

var Footer = {
  init: function() {
    this.$footer = $('footer')
    this.$ul = this.$footer.find('ul')
    this.$box = this.$footer.find('.box')
    this.$prevBtn = this.$footer.find('.prev')
    this.$nextBtn = this.$footer.find('.next')
    this.isScrollEnd = false
    this.isScrollStart = true
    // 防止过快点击，即使到了最后依然会有向左偏移或是向右移偏移
    this.isAnimate = false

    this.bind()
    this.render()
  },
  bind: function() {
    var _this = this
    this.$nextBtn .on('click', function() {
      if (_this.isAnimate) return
     // 下次切换展示的开头都是全新的(就是之前位于这一行末尾的，没有被完整显示的)  
      var itemCount = _this.$box.find('li').length
      var ulStyle = window.getComputedStyle(_this.$ul[0],null)
      var itemWidth = _this.$box.find('li').outerWidth(true)
      var rowCount = Math.floor(_this.$box.outerWidth(true)/itemWidth)
      if (!_this.isScrollEnd) {
        _this.isAnimate = true
        _this.$ul.animate({
          'margin-left': '-='+ rowCount*itemWidth
        }, 500, function() {
          _this.isAnimate = false
          // margin-left是一个负数，所以要取反,leftAlready 表示已经向左偏移被挡住不可见的数量
          var leftAlready = -Math.floor(parseInt(ulStyle.getPropertyValue('margin-left'))/itemWidth)
          var notLeftCount = itemCount - leftAlready
          // 当点击nextBtn的时候，要确保之后点击 prevBtn也能正常发生偏移
          _this.isScrollStart = false
          if (notLeftCount < rowCount) {
            _this.isScrollEnd = true
            _this.$nextBtn.css('cursor', 'not-allowed')
          } 
        })
      }
    })
    this.$prevBtn.on('click', function() {
      if (_this.isAnimate) retun 
      var ulStyle = window.getComputedStyle(_this.$ul[0],null)
      var itemWidth = _this.$box.find('li').outerWidth(true)
      var rowCount = Math.floor(_this.$box.outerWidth(true)/itemWidth)
      if (!_this.isScrollStart) {
        _this.isAnimate = true
        _this.$ul.animate({
          'margin-left': '+='+ rowCount*itemWidth
        }, 500, function() {
          _this.isAnimate = false
            var leftMargin = parseInt(ulStyle.getPropertyValue('margin-left'))
            // 当点击prevBtn的时候，要确保之后点击 nextBtn也能正常发生偏移
            _this.isScrollEnd = false
            if (leftMargin >= 0) {
            _this.isScrollStart = true
          } 
        })
      }
    })
    this.$footer.on('click', 'li', function() {
      $(this).addClass('active')
             .siblings()
             .removeClass('active')
      // 通过事件中心联通两部分footer 与 main 
      EventCenter.fire('selected-themeSong', {
        channelId: $(this).attr('data-channel-id'),
        channelName: $(this).find('figcaption').text()
      })
    })
  },
  render: function() {
    var _this = this 
    $.getJSON('https://jirenguapi.applinzi.com/fm/v2/getChannels.php')
     .done(function(ret) {
        console.log(ret)
        // api的返回的数据都包裹在一个 属性名为channels的对象中
        _this.renderFooter(ret.channels)
     })
     .fail(function() {
       console.log('Error!')
     })
  },
  // 拼装 footer显示部分的HTML
  renderFooter: function(channels) {
    console.log(channels)
    var html = ''
    channels.forEach(function(channel) {
      html += '<li data-channel-id='+channel.channel_id+'>'
           +    '<figure class="cover" style="background-image:url('+channel.cover_small+')"></figure>'
           +    '<figcaption>'+channel.name+'</figcaption>'
           + '</li>'
    })
    this.$ul.html(html)
    // this.setStyle()
  }
}

var App = {
  init: function() {
    this.$container = $('#page-music')
    this.audio = new Audio()
    this.audio.autoplay = true

    this.bind()
  },
  bind: function() {
    var _this = this
    EventCenter.on('selected-themeSong', function(e, channelObj) {
      _this.channelId = channelObj.channelId
      _this.channelName = channelObj.channelName
      _this.loadMusic(function() {
        _this.setMusic()
      })  
    })
    // 暂停播放按钮切换
    this.$container.find('.btn-play').on('click', function() {
      var $btn = $(this)
      if($btn.hasClass('icon-play')) {
        $btn.removeClass('icon-play').addClass('icon-pause')
        _this.audio.play()
      } else {
        $btn.removeClass('icon-pause').addClass('icon-play')
        _this.audio.pause()
      }
    })
    // 下一曲
    this.$container.find('.btn-next').on('click', function() {
      _this.loadMusic(
        // 需要重置暂停与播放的状态，不然会出现在暂停的情况下，
        // 点击下一曲，依然会在暂停按钮的情况下，播放歌曲
      )
    })

    this.audio.addEventListener('play', function() {
      // console.log('play...')
      // 在播放下一曲的时候删除上一曲的定时器
      clearInterval(_this.statusClock)
      _this.statusClock = setInterval(function() {
        _this.updateStatus()
      }, 1000)
    })
    this.audio.addEventListener('pause', function() {
      clearInterval(_this.statusClock)
    })
  },
  loadMusic(callback) {
    var _this = this
    // 如双斜杆 前面不加协议，到时候会默认为打开页面所对应的url的协议
    $.getJSON('https://jirenguapi.applinzi.com/fm/v2/getSong.php', {channel:
      this.channelId
    }).done(function(ret) {
        _this.song = ret['song'][0]
        _this.setMusic()
        _this.loadLyric()
    })
  }, 
  loadLyric() {
    var _this = this 
    $.getJSON('https://jirenguapi.applinzi.com/fm/v2/getLyric.php', {sid:
      this.song.sid
    }).done(function(ret) {
       // 歌词的处理
        var lyric = ret.lyric
        var lyricObj = {}
        lyric.split('\n').forEach(function(line) {
          // 歌曲前面的被 [] 包裹的时间 [01:20:22] [01:39:22],有可能两个时间点的歌词是同样的
          var times = line.match(/\d{2}:\d{2}/g)
          // 去掉歌词前面的被[]符号，包裹的时间信息如 [01:56.30]，只获得歌词的信息
          var str = line.replace(/\[.+?\]/g,'')
          // console.log(str)
          if(Array.isArray(times)){
            times.forEach(function(time) {
              lyricObj[time] = str
            }) 
          }
        })
        _this.lyricObj = lyricObj
        // 打印歌曲对应的消息
        // console.log(lyricObj)
    })
  },
  setMusic() {
    // console.log('set Mussic ok...')
    this.audio.src = this.song.url
    $('.bg').css('background-image', 'url('+this.song.picture+')')
    console.log(this.song)
    this.$container.find('.aside figure').css('background-image', 'url('+this.song.picture+')')
    this.$container.find('.detail h1').text(this.song.title)   
    this.$container.find('.detail .author').text(this.song.artist)   
    // 是上下两部分的channelName一致
    this.$container.find('.detail .tag').text(this.channelName)   
    // 下一曲重置歌曲的切换按钮的状态
    this.$container.find('.btn-play').removeClass('icon-play').addClass('icon-pause')
    
  },
  updateStatus() {
    // 已播放时间的获取
    var timeMin = Math.floor(this.audio.currentTime/60)
    // 一定要 timeSec转化为字符串
    var timeSec = Math.floor(this.audio.currentTime%60)+ ''
    timeSec = timeSec.length === 2 ? timeSec : '0'+timeSec
    this.$container.find('.current-time').text(timeMin+':'+timeSec)
    this.$container.find('.bar-progress').css('width',
      this.audio.currentTime/this.audio.duration*100+'%'
    )
    console.log(this.lyricObj['0'+timeMin+':'+timeSec])
    var line = this.lyricObj['0'+timeMin+':'+timeSec]
    if (line) {
      this.$container.find('.lyric p')
                     .text(line).funcyText('rollIn')
                     // 使用Jquery插件funcyText  
    }
  }
}

// Jquery 插件实现歌词特效
$.fn.funcyText = function(type) {
  type = type || 'rollIn'
  // this 指代的是调用这个插件的对象，如🌰中的$('.lyric p')
  var fragmentHtml = $(this).text().split('').map(function(singleHans) {
    return '<span style="opacity: 0; display: inline-block;">'+singleHans+'</span>'
  })
  this.html(fragmentHtml.join(''))

  var index = 0
  var $funcyText = $(this).find('span')
  var timer = setInterval(function() {
    // animated与type之间一定要隔开一个 空格
    $funcyText.eq(index).addClass('animated '+type)
    index++
    if(index >= $funcyText.length) {
      clearInterval(timer)
    }
  }, 400)
}
// 使用Jquer插件
// $('.lyric').funcyText('rollIn')
Footer.init()
App.init()

// 打开页面自动，自动播放歌曲有bug
// $(window).load('load', function(e) {
//   var autoClock = setTimeout(function() {
//     console.log(e)
//     this.$('footer li').eq(0).trigger('click')
//     console.log('hahha...')
//   }, 2000)
//   // clearInterval(autoClock)
// })