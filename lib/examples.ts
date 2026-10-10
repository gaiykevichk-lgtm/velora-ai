const base = 'https://storage.yandexcloud.net/promto-user-static-sites-prod/design-assets/905678257/54b9bf77-a54d-4510-9ce5-4602ecb42756/';
export const examples = [
 {title:'Editorial portrait',category:'Portrait',file:'7881798e-1d49-4ee8-ba0d-34926d662a0a-b9848315-90b0-4366-96ed-fff0bdc018ce-0.jpg',alt:'Freckled woman in a burgundy jacket in cinematic sunlight'},
 {title:'Amber & light',category:'Product',file:'cfa54164-8d31-4d99-b6a5-b4953b9f2e7b-a9b74073-5d86-4bb8-9c45-6889217f6ae1-0.jpg',alt:'Amber perfume bottle on travertine with warm botanical shadows'},
 {title:'Alpine stillness',category:'Landscape',file:'598b8d78-801e-411f-b45a-c86d62332fd2-e9e366ca-324c-4d55-91ef-0bfab4fa36e3-0.jpg',alt:'Mountain cabin by a turquoise alpine lake at dawn'},
 {title:'Coastal sanctuary',category:'Architecture',file:'2bdd5ba5-53ca-4674-94c5-3be3fb40f6f4-d2f52849-ef86-49fc-bc34-78b80e1e5a76-0.jpg',alt:'Mediterranean villa interior with a sculptural arch and sea view'},
 {title:'After the sunset',category:'Automotive',file:'d01b9c82-337f-4623-bbc3-d72f3a3f5b19-bb13a35e-8e9a-4f11-b890-9d31d59f1e09-0.jpg',alt:'Silver sports coupe on a coastal road at blue hour'},
 {title:'Taste of summer',category:'Food',file:'1a11dfef-5a8c-41a9-896e-52020bfe3e4b-ebe24037-f25e-4434-a950-37c62e8ec2d7-0.jpg',alt:'Burrata with heirloom tomatoes and fresh basil on ceramic'},
 {title:'Petal poetry',category:'Macro',file:'1514bb4e-c1b8-4024-8879-7c27e2d09c69-6400c3e7-5be1-4259-8e3f-570fabccfa21-0.jpg',alt:'Coral dahlia flower with dew drops against deep green'},
 {title:'Neon rain',category:'Street',file:'1a788157-51d0-481e-9356-cb6793fa13d8-8c6229b1-1e63-4f64-a65d-7d95d5f7405b-0.jpg',alt:'Umbrella pedestrian in a rain-soaked cinematic night street'},
].map(example => ({...example,url:base+example.file}));
