/*
  Dữ liệu khóa học Aluni.
  Mỗi video dùng: { title: "Tên video", youtube: "LINK_YOUTUBE" }
  Tài liệu dùng:  { title: "Tên tài liệu", url: "LINK_PDF" }
*/
(function(){
  const lessonNames = [
    'Làm quen với Pinyin','Bốn thanh điệu','Thanh mẫu b p m f','Thanh mẫu d t n l',
    'Thanh mẫu g k h','Thanh mẫu j q x','Thanh mẫu zh ch sh r','Thanh mẫu z c s',
    'Vận mẫu a o e','Vận mẫu i u ü','Vận mẫu ai ei ui','Vận mẫu ao ou iu',
    'Vận mẫu ie üe er','Vận mẫu an en in un ün','Vận mẫu ang eng ing ong','Ghép thanh mẫu và vận mẫu',
    'Quy tắc viết Pinyin','Quy tắc đặt dấu thanh','Biến điệu thanh 3','Biến điệu của 一',
    'Biến điệu của 不','Âm nhẹ','Âm cuốn lưỡi 儿化','Cách đọc ü sau j q x',
    'Phân biệt b và p','Phân biệt d và t','Phân biệt g và k','Phân biệt j q x',
    'Phân biệt zh ch sh','Phân biệt z c s','Phân biệt n và l','Phân biệt an và ang',
    'Phân biệt en và eng','Phân biệt in và ing','Luyện nghe thanh điệu 1–2','Luyện nghe thanh điệu 2–3',
    'Luyện nghe thanh điệu 3–4','Luyện đọc từ hai âm tiết','Luyện đọc từ ba âm tiết','Luyện đọc câu ngắn',
    'Luyện đọc hội thoại 1','Luyện đọc hội thoại 2','Sửa lỗi phát âm thường gặp 1','Sửa lỗi phát âm thường gặp 2',
    'Luyện phản xạ nghe – đọc','Luyện đọc đoạn văn ngắn','Ôn tập tổng hợp','Kiểm tra Pinyin cuối khóa'
  ];
  window.ALUNI_COURSES = [
    {
      id:'pinyin-48', title:'Pinyin tiếng Trung từ cơ bản', icon:'拼', access:'free',
      description:'Khóa học miễn phí gồm 48 bài video, học lần lượt từ phát âm đến luyện đọc tổng hợp.',
      lessons:lessonNames.map((title,index)=>({
        id:`pinyin-${String(index+1).padStart(2,'0')}`,
        number:index+1,
        title,
        videos:[],
        resources:[]
      }))
    },
    {id:'50plus-course',title:'50+ Phản xạ tiếng Trung',icon:'50+',access:'paid',description:'Khóa nền tảng giúp hình thành phản xạ giao tiếp theo chủ đề.',lessons:[]},
    {id:'npcr-course',title:'Giáo trình Hán ngữ NPCR',icon:'汉',access:'paid',description:'Video bài giảng, từ vựng, ngữ pháp và bài tập theo từng bài.',lessons:[]}
  ];
})();
