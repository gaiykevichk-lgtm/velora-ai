export const presets = {
  text: [
    {title:'Write anything', tag:'WRITING', prompt:'Write a compelling introduction about ', icon:'✳'},
    {title:'Think it through', tag:'REASONING', prompt:'Help me think through the following problem step by step: ', icon:'◈'},
    {title:'Summarize a document', tag:'PRODUCTIVITY', prompt:'Summarize the following text into clear key takeaways: ', icon:'▤'},
    {title:'Code companion', tag:'DEVELOPMENT', prompt:'Help me write clean, maintainable code for ', icon:'⌘'},
  ],
  image: [
    {title:'Editorial portrait', tag:'PHOTOGRAPHY', prompt:'Editorial portrait of a creative professional, natural light, cinematic composition, ', icon:'◉'},
    {title:'Product studio', tag:'COMMERCE', prompt:'Premium studio product photography, minimal backdrop, soft shadows, ', icon:'◇'},
    {title:'Dreamscape', tag:'ART DIRECTION', prompt:'Surreal dreamscape, atmospheric lighting, art-directed detail, ', icon:'✦'},
    {title:'Brand visual', tag:'DESIGN', prompt:'Distinctive brand campaign visual, elegant typography space, ', icon:'▧'},
  ],
  video: [
    {title:'Cinematic scene', tag:'FILM', prompt:'Cinematic tracking shot, dramatic natural light, subtle camera movement, ', icon:'▣'},
    {title:'Product reveal', tag:'ADVERTISING', prompt:'Premium product reveal, slow camera orbit, polished studio light, ', icon:'◇'},
    {title:'Social loop', tag:'SOCIAL', prompt:'Seamless short loop, dynamic movement, vibrant visual hook, ', icon:'↝'},
    {title:'Animate an image', tag:'IMAGE TO VIDEO', prompt:'Animate the reference image with subtle, lifelike movement, ', icon:'◌'},
  ],
} as const;
