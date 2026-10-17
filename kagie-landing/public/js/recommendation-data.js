(function (root) {
  'use strict';

  // Existing Kagie guidance catalogue. Confirm current programme details in the prospectus.
  const data = {
    subjects: ["Afrikaans Home Language", "Afrikaans First Additional Language", "English Home Language", "English First Additional Language", "isiNdebele Home Language", "isiNdebele First Additional Language", "isiXhosa Home Language", "isiXhosa First Additional Language", "isiZulu Home Language", "isiZulu First Additional Language", "Sepedi Home Language", "Sepedi First Additional Language", "Sesotho Home Language", "Sesotho First Additional Language", "Setswana Home Language", "Setswana First Additional Language", "Siswati Home Language", "Siswati First Additional Language", "Tshivenda Home Language", "Tshivenda First Additional Language", "Xitsonga Home Language", "Xitsonga First Additional Language", "Afrikaans Second Additional Language", "English Second Additional Language", "French Second Additional Language", "isiNdebele Second Additional Language", "isiXhosa Second Additional Language", "isiZulu Second Additional Language", "Mandarin Second Additional Language", "Sepedi Second Additional Language", "Sesotho Second Additional Language", "Setswana Second Additional Language", "Siswati Second Additional Language", "Tshivenda Second Additional Language", "Xitsonga Second Additional Language", "South African Sign Language Home Language", "Accounting", "Agricultural Management Practices", "Agricultural Sciences", "Agricultural Technology", "Business Studies", "Civil Technology", "Computer Applications Technology", "Consumer Studies", "Dance Studies", "Design Studies", "Dramatic Arts", "Economics", "Electrical Technology", "Engineering Graphics and Design", "Equine Studies", "Geography", "History", "Hospitality Studies", "Information Technology", "Life Orientation", "Life Sciences", "Marine Sciences", "Maritime Economics", "Mathematical Literacy", "Mathematics", "Mechanical Technology", "Music", "Nautical Science", "Physical Sciences", "Religion Studies", "Sport and Exercise Science", "Technical Mathematics", "Technical Sciences", "Technical: Civil Technology", "Technical: Electrical Technology", "Technical: Mechanical Technology", "Tourism", "Visual Arts"],
    courses: [{
      "id": "c1",
      "courseName": "BSc Computer Science",
      "faculty": "Science",
      "institution": "University of KwaZulu-Natal",
      "province": "KwaZulu-Natal",
      "type": "University",
      "minAps": 30,
      "requiredSubjects": [{
        "name": "English",
        "min": 50
      }, {
        "name": "Mathematics",
        "min": 60
      }],
      "recommendedSubjects": [{
        "name": "Physical Sciences",
        "min": 50
      }, {
        "name": "Information Technology",
        "min": 50
      }],
      "interestTags": ["Technology", "Science"],
      "description": "Explore computing, programming and problem-solving through a computer science pathway.",
      "qualification": "Undergraduate"
    }, {
      "id": "c2",
      "courseName": "Diploma in Information Technology",
      "faculty": "ICT",
      "institution": "Durban University of Technology",
      "province": "KwaZulu-Natal",
      "type": "University",
      "minAps": 26,
      "requiredSubjects": [{
        "name": "English",
        "min": 50
      }, {
        "name": "Mathematics",
        "min": 40
      }],
      "recommendedSubjects": [{
        "name": "Computer Applications Technology",
        "min": 50
      }, {
        "name": "Information Technology",
        "min": 50
      }],
      "interestTags": ["Technology"],
      "description": "Develop practical information technology skills and explore careers in computing and systems support.",
      "qualification": "Diploma"
    }, {
      "id": "c3",
      "courseName": "Bachelor of Education",
      "faculty": "Education",
      "institution": "University of Zululand",
      "province": "KwaZulu-Natal",
      "type": "University",
      "minAps": 24,
      "requiredSubjects": [{
        "name": "English",
        "min": 50
      }],
      "recommendedSubjects": [{
        "name": "History",
        "min": 40
      }, {
        "name": "Geography",
        "min": 40
      }],
      "interestTags": ["Education"],
      "description": "Explore a teaching pathway, with subject specialisation and practical classroom skills.",
      "qualification": "Undergraduate"
    }, {
      "id": "c4",
      "courseName": "Diploma in Nursing",
      "faculty": "Health Sciences",
      "institution": "Mangosuthu University of Technology",
      "province": "KwaZulu-Natal",
      "type": "University",
      "minAps": 26,
      "requiredSubjects": [{
        "name": "English",
        "min": 50
      }, {
        "name": "Life Sciences",
        "min": 50
      }],
      "recommendedSubjects": [{
        "name": "Mathematics",
        "min": 40
      }, {
        "name": "Physical Sciences",
        "min": 40
      }],
      "interestTags": ["Health", "Science"],
      "description": "Explore nursing and patient-care pathways using your language and science strengths.",
      "qualification": "Diploma"
    }, {
      "id": "c5",
      "courseName": "BCom Accounting",
      "faculty": "Commerce",
      "institution": "University of Johannesburg",
      "province": "Gauteng",
      "type": "University",
      "minAps": 32,
      "requiredSubjects": [{
        "name": "English",
        "min": 50
      }, {
        "name": "Mathematics",
        "min": 60
      }],
      "recommendedSubjects": [{
        "name": "Accounting",
        "min": 55
      }, {
        "name": "Business Studies",
        "min": 50
      }],
      "interestTags": ["Business"],
      "description": "Build on your quantitative and business subjects through an accounting pathway.",
      "qualification": "Undergraduate"
    }, {
      "id": "c6",
      "courseName": "Diploma in Public Management",
      "faculty": "Management Sciences",
      "institution": "Mangosuthu University of Technology",
      "province": "KwaZulu-Natal",
      "type": "University",
      "minAps": 22,
      "requiredSubjects": [{
        "name": "English",
        "min": 45
      }],
      "recommendedSubjects": [{
        "name": "Business Studies",
        "min": 45
      }, {
        "name": "Economics",
        "min": 45
      }],
      "interestTags": ["Business", "Law"],
      "description": "Explore public management, administration and service-delivery pathways.",
      "qualification": "Diploma"
    }, {
      "id": "c7",
      "courseName": "LLB",
      "faculty": "Law",
      "institution": "University of South Africa",
      "province": "Gauteng",
      "type": "University",
      "minAps": 30,
      "requiredSubjects": [{
        "name": "English",
        "min": 60
      }],
      "recommendedSubjects": [{
        "name": "History",
        "min": 50
      }, {
        "name": "Business Studies",
        "min": 50
      }],
      "interestTags": ["Law"],
      "description": "Explore legal studies and develop your reading, reasoning and communication skills.",
      "qualification": "Undergraduate"
    }, {
      "id": "c8",
      "courseName": "BEng Civil Engineering",
      "faculty": "Engineering",
      "institution": "University of Pretoria",
      "province": "Gauteng",
      "type": "University",
      "minAps": 34,
      "requiredSubjects": [{
        "name": "English",
        "min": 50
      }, {
        "name": "Mathematics",
        "min": 70
      }, {
        "name": "Physical Sciences",
        "min": 65
      }],
      "recommendedSubjects": [{
        "name": "Geography",
        "min": 50
      }],
      "interestTags": ["Engineering", "Science"],
      "description": "Explore civil engineering and the role of mathematics and science in the built environment.",
      "qualification": "Undergraduate"
    }, {
      "id": "c9",
      "courseName": "Higher Certificate in Office Administration",
      "faculty": "Business Support",
      "institution": "TVET College",
      "province": "KwaZulu-Natal",
      "type": "College",
      "minAps": 18,
      "requiredSubjects": [{
        "name": "English",
        "min": 40
      }],
      "recommendedSubjects": [{
        "name": "Business Studies",
        "min": 40
      }, {
        "name": "Computer Applications Technology",
        "min": 40
      }],
      "interestTags": ["Business"],
      "description": "Explore an office administration pathway, building on organisation and communication skills.",
      "qualification": "Certificate"
    }, {
      "id": "c10",
      "courseName": "BA Journalism and Media Studies",
      "faculty": "Humanities",
      "institution": "Rhodes University",
      "province": "Eastern Cape",
      "type": "University",
      "minAps": 30,
      "requiredSubjects": [{
        "name": "English",
        "min": 65
      }],
      "recommendedSubjects": [{
        "name": "History",
        "min": 50
      }, {
        "name": "Dramatic Arts",
        "min": 50
      }],
      "interestTags": ["Media"],
      "description": "Explore journalism, communication and media-related study paths.",
      "qualification": "Undergraduate"
    }, {
      "id": "c11",
      "courseName": "BSc Agriculture",
      "faculty": "Agriculture",
      "institution": "University of Fort Hare",
      "province": "Eastern Cape",
      "type": "University",
      "minAps": 24,
      "requiredSubjects": [{
        "name": "English",
        "min": 45
      }],
      "recommendedSubjects": [{
        "name": "Life Sciences",
        "min": 45
      }, {
        "name": "Agricultural Sciences",
        "min": 50
      }],
      "interestTags": ["Science"],
      "description": "Explore agriculture and related science pathways, building on your life-science subjects.",
      "qualification": "Undergraduate"
    }, {
      "id": "c12",
      "courseName": "Diploma in Marketing",
      "faculty": "Management Sciences",
      "institution": "Cape Peninsula University of Technology",
      "province": "Western Cape",
      "type": "University",
      "minAps": 24,
      "requiredSubjects": [{
        "name": "English",
        "min": 50
      }],
      "recommendedSubjects": [{
        "name": "Business Studies",
        "min": 50
      }, {
        "name": "Economics",
        "min": 45
      }],
      "interestTags": ["Business", "Media"],
      "description": "Explore marketing, business communication and management-related pathways.",
      "qualification": "Diploma"
    }],
    fields: ['Technology', 'Business', 'Health', 'Education', 'Law', 'Science', 'Engineering', 'Media']
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data;
  } else {
    root.KagieRecommendationData = data;
  }
})(typeof window !== 'undefined' ? window : globalThis);
